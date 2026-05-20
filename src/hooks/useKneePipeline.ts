/**
 * useKneePipeline / useRehabPipeline
 *
 * Manages the full rehab ML pipeline for one body part:
 *  - Camera feed via getUserMedia
 *  - Pose estimation via MediaPipe PoseLandmarker
 *  - 30-frame skeleton buffer → /api/{rehabType}/skeleton/predict
 *  - Rep counting via on-device joint-angle peak detection
 *
 * The skeleton133 model behind every endpoint is the same whole-body model;
 * `rehabType` only picks which API URL to call so that backend logging /
 * future per-body-part model selection stays clean.
 */

import { useRef, useState, useCallback, useEffect, type RefObject } from "react";
import { mediapipeToSkeleton133, SKELETON_CONNECTIONS, type Vec3 } from "../lib/mediapipeMapper";
import {
  rehabApi,
  type SkeletonPrediction,
  type IMUPrediction,
  type RehabModuleType,
} from "../lib/rehabApi";
import type { RepDetection } from "../types";

// (proximal, middle, distal) joint indices from Skeleton133Config.angle_triplets.
// "middle" is the joint the angle is measured at.
const ANGLE_TRIPLETS: Record<RehabModuleType, [number, number, number]> = {
  knee:  [21, 22, 23], // right hip → right knee → right ankle
  leg:   [21, 22, 23],
  elbow: [12, 13, 14], // right shoulder → right elbow → right wrist
};

// Joint highlight indices per rehab type (drawn in yellow on the overlay).
const HIGHLIGHT_JOINTS: Record<RehabModuleType, number[]> = {
  knee:  [17, 22],
  leg:   [17, 22],
  elbow: [8, 13],
};

// Raw MediaPipe landmark indices we read visibility from, per rehab type.
// MediaPipe still emits guessed positions for occluded limbs, so we have to
// look at the visibility field to decide if the body part is actually in
// frame before counting a rep or calling the form-classification model.
//   knee/leg: right hip (24), right knee (26), right ankle (28)
//   elbow:    right shoulder (12), right elbow (14), right wrist (16)
const VISIBILITY_LANDMARKS: Record<RehabModuleType, [number, number, number]> = {
  knee:  [24, 26, 28],
  leg:   [24, 26, 28],
  elbow: [12, 14, 16],
};

// Minimum MediaPipe-reported visibility for the body part to count as
// "in frame". Below this, the model is essentially guessing.
const VISIBILITY_THRESHOLD = 0.5;

// MediaPipe tasks-vision — imported lazily to avoid build-time issues
type PoseLandmarker = import("@mediapipe/tasks-vision").PoseLandmarker;
type NormalizedLandmark = { x: number; y: number; z: number; visibility?: number };

const SKELETON_BUFFER_SIZE = 30;  // frames to accumulate before inference
const INFERENCE_INTERVAL_MS = 100; // minimum ms between inferences

// Default angle thresholds for rep state machine — overridable per exercise
// via options.repDetection. The hip-knee-ankle angle is ~180° when leg is
// fully extended and drops as the knee flexes.
const DEFAULT_FLEX_ANGLE      = 130; // below this we consider the joint flexed
const DEFAULT_EXTEND_ANGLE    = 160; // above this we consider it extended
const REP_REFRACTORY_MS       = 600; // ignore rep transitions within this window

export type PipelineStatus = "idle" | "initializing" | "running" | "error";

export interface KneePrediction {
  skeleton: SkeletonPrediction | null;
  imu: IMUPrediction | null;
  timestamp: number;
}

export interface UseKneePipelineOptions {
  /** ML label (e.g. "Ex4") the patient is supposed to be performing. Used to
   *  compare against the model's classification and surface "match" feedback. */
  targetMlLabel?: string | null;
  /** Which rehab module this pipeline is for. Controls API URL + angle joints. */
  rehabType?: RehabModuleType;
  /**
   * Per-exercise rep detection strategy. When strategy is 'angle' the hook
   * looks for joint-angle peaks; when 'hold' the hook just ticks the rep
   * counter every `holdSec` while the camera is running. If omitted, falls
   * back to the previous behavior (angle 130/160).
   */
  repDetection?: RepDetection;
}

export interface SessionStats {
  /** Largest joint angle observed during the run, in degrees. */
  maxAngle: number;
  /** Smallest non-zero joint angle observed during the run, in degrees. */
  minAngle: number;
  /** maxAngle − minAngle, in degrees. 0 if no angle samples. */
  romDegrees: number;
  /** Mean of all per-frame skeleton form scores recorded (0-100). 0 if none. */
  avgFormScore: number;
}

export interface UseKneePipelineReturn {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  status: PipelineStatus;
  prediction: KneePrediction | null;
  error: string | null;
  isServerOnline: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  resetReps: () => void;
  /** Stop reps from accruing without tearing down the camera. */
  pauseCounting: () => void;
  /** Resume counting after a pause. Restarts hold-timer rhythm. */
  resumeCounting: () => void;
  /** Pull the current ROM / form aggregates. Safe to call any time. */
  getSessionStats: () => SessionStats;
  repCount: number;
  formScore: number | null;
  kneeAngle: number | null;
  /** True when the model's predicted exercise matches `options.targetMlLabel` */
  matchesTarget: boolean | null;
  /** Live human-readable coaching messages (form warnings, ROM hints). */
  feedback: string[];
}

export function useKneePipeline(options: UseKneePipelineOptions = {}): UseKneePipelineReturn {
  const { targetMlLabel = null, rehabType = "knee", repDetection } = options;
  const angleJoints      = ANGLE_TRIPLETS[rehabType];
  const highlightIdxs    = HIGHLIGHT_JOINTS[rehabType];
  const visibilityJoints = VISIBILITY_LANDMARKS[rehabType];

  // Resolve effective rep config (defaults preserve the old angle-peak behavior).
  const repStrategy   = repDetection?.strategy ?? 'angle';
  const flexThreshold = repDetection?.flexedAt   ?? DEFAULT_FLEX_ANGLE;
  const extThreshold  = repDetection?.extendedAt ?? DEFAULT_EXTEND_ANGLE;
  const holdSec       = repDetection?.holdSec    ?? 4;
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [status,        setStatus]        = useState<PipelineStatus>("idle");
  const [prediction,    setPrediction]    = useState<KneePrediction | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [isServerOnline,setIsServerOnline] = useState(false);
  const [repCount,      setRepCount]      = useState(0);
  const [formScore,     setFormScore]     = useState<number | null>(null);
  const [kneeAngle,     setKneeAngle]     = useState<number | null>(null);
  // null = camera not running yet; true/false = whether the relevant body
  // part is currently in frame at acceptable visibility.
  const [bodyPartVisible, setBodyPartVisible] = useState<boolean | null>(null);

  const poseLandmarkerRef  = useRef<PoseLandmarker | null>(null);
  const animFrameRef       = useRef<number | null>(null);
  const streamRef          = useRef<MediaStream | null>(null);
  const skeletonBufferRef  = useRef<Vec3[][]>([]);
  const lastInferenceRef   = useRef<number>(0);
  const isRunningRef       = useRef(false);

  // Rep state machine: 'extended' → 'flexed' → 'extended' counts one rep.
  const repPhaseRef        = useRef<'extended' | 'flexed' | 'unknown'>('unknown');
  const lastRepTRef        = useRef<number>(-Infinity);

  // Aggregate stats for the running session — read by the page on completion
  // to persist ROM + form score to Firestore. Kept in refs to avoid re-renders.
  const maxAngleRef        = useRef(-Infinity);
  const minAngleRef        = useRef(Infinity);
  const formScoreSumRef    = useRef(0);
  const formScoreCountRef  = useRef(0);

  // Hold-strategy timer. Ticks every holdSec seconds while the camera is
  // running AND counting is not paused. Pause/resume is what the page uses
  // to stop reps from accruing during the rest period between sets.
  const holdTimerRef       = useRef<number | null>(null);
  const countingActiveRef  = useRef(true);
  // Mirrors `bodyPartVisible` so the hold-timer callback can read it
  // without re-creating the interval on every visibility change.
  const bodyPartVisibleRef = useRef(false);
  // Live copies of mutable config so timer callbacks see fresh values
  // without re-creating the callbacks on every render.
  const repStrategyRef     = useRef(repStrategy);
  const holdSecRef         = useRef(holdSec);
  useEffect(() => {
    repStrategyRef.current = repStrategy;
    holdSecRef.current     = holdSec;
  }, [repStrategy, holdSec]);

  const stopHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const startHoldTimer = useCallback(() => {
    stopHoldTimer();
    if (
      repStrategyRef.current === 'hold' &&
      isRunningRef.current &&
      countingActiveRef.current
    ) {
      holdTimerRef.current = window.setInterval(() => {
        // Don't tick reps for an empty frame — the user has to actually be
        // visible to the camera for the hold to count. This is what stops
        // hold-strategy exercises from auto-completing when only the face is
        // visible (or no body at all).
        if (!bodyPartVisibleRef.current) return;
        setRepCount((r) => r + 1);
      }, holdSecRef.current * 1000);
    }
  }, [stopHoldTimer]);

  /** Page calls this when entering a rest stage so no reps accrue during the break. */
  const pauseCounting = useCallback(() => {
    countingActiveRef.current = false;
    stopHoldTimer();
  }, [stopHoldTimer]);

  /** Page calls this when leaving the rest stage. Restarts the hold rhythm cleanly. */
  const resumeCounting = useCallback(() => {
    countingActiveRef.current = true;
    startHoldTimer();
  }, [startHoldTimer]);

  const resetReps = useCallback(() => {
    setRepCount(0);
    repPhaseRef.current = 'unknown';
    lastRepTRef.current = -Infinity;
    maxAngleRef.current = -Infinity;
    minAngleRef.current = Infinity;
    formScoreSumRef.current = 0;
    formScoreCountRef.current = 0;
    // Restart the hold timer so the next rep fires holdSec from now,
    // not whenever the previous interval was scheduled to tick.
    startHoldTimer();
  }, [startHoldTimer]);

  const getSessionStats = useCallback((): SessionStats => {
    const maxA = maxAngleRef.current === -Infinity ? 0 : maxAngleRef.current;
    const minA = minAngleRef.current === Infinity  ? 0 : minAngleRef.current;
    const rom  = Math.max(0, maxA - minA);
    const avgFormScore = formScoreCountRef.current > 0
      ? Math.round(formScoreSumRef.current / formScoreCountRef.current)
      : 0;
    return { maxAngle: maxA, minAngle: minA, romDegrees: rom, avgFormScore };
  }, []);

  // ── Check server health once on mount ─────────────────────────────────────
  useEffect(() => {
    rehabApi[rehabType].health()
      .then(() => setIsServerOnline(true))
      .catch(() => setIsServerOnline(false));
  }, [rehabType]);

  // ── Initialise MediaPipe PoseLandmarker ────────────────────────────────────
  const initPoseLandmarker = useCallback(async (): Promise<PoseLandmarker> => {
    const { PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    const pl = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    return pl;
  }, []);

  // ── Draw skeleton overlay on canvas ────────────────────────────────────────
  const drawSkeleton = useCallback(
    (ctx: CanvasRenderingContext2D, joints: Vec3[], w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);

      // Bones
      ctx.strokeStyle = "rgba(74, 222, 128, 0.8)";
      ctx.lineWidth   = 2;
      for (const [a, b] of SKELETON_CONNECTIONS) {
        if (!joints[a] || !joints[b]) continue;
        ctx.beginPath();
        ctx.moveTo(joints[a][0] * w, joints[a][1] * h);
        ctx.lineTo(joints[b][0] * w, joints[b][1] * h);
        ctx.stroke();
      }

      // Joints
      ctx.fillStyle = "rgba(52, 211, 153, 1)";
      for (const j of joints) {
        if (!j) continue;
        ctx.beginPath();
        ctx.arc(j[0] * w, j[1] * h, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Highlight the joint(s) most relevant to this rehab type
      ctx.fillStyle = "rgba(250, 204, 21, 1)";
      for (const idx of highlightIdxs) {
        const j = joints[idx];
        if (!j) continue;
        ctx.beginPath();
        ctx.arc(j[0] * w, j[1] * h, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [highlightIdxs]
  );

  // ── Estimate joint angle (knee for knee/leg, elbow for elbow) ───────────────
  const estimateKneeAngle = useCallback((joints: Vec3[]): number => {
    const [pIdx, mIdx, dIdx] = angleJoints;
    const [p, m, d] = [joints[pIdx], joints[mIdx], joints[dIdx]];
    if (!p || !m || !d) return 0;
    const v1 = [p[0] - m[0], p[1] - m[1], p[2] - m[2]];
    const v2 = [d[0] - m[0], d[1] - m[1], d[2] - m[2]];
    const dot = v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
    const n1  = Math.sqrt(v1[0]**2 + v1[1]**2 + v1[2]**2) + 1e-9;
    const n2  = Math.sqrt(v2[0]**2 + v2[1]**2 + v2[2]**2) + 1e-9;
    return Math.round(Math.acos(Math.max(-1, Math.min(1, dot / (n1 * n2)))) * (180 / Math.PI));
  }, [angleJoints]);

  // ── Main detection loop ────────────────────────────────────────────────────
  const detectLoop = useCallback(async () => {
    if (!isRunningRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const pl     = poseLandmarkerRef.current;
    if (!video || !canvas || !pl || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const now = performance.now();
    const result = pl.detectForVideo(video, now);

    if (result.landmarks?.length) {
      const rawLandmarks = result.landmarks[0] as NormalizedLandmark[];

      // Check that the body part this exercise targets is actually visible.
      // MediaPipe returns guessed positions even for off-screen limbs, so
      // without this check a user showing only their face would get phantom
      // leg landmarks and a phantom rep count.
      const [vA, vB, vC] = visibilityJoints;
      const vis = Math.min(
        rawLandmarks[vA]?.visibility ?? 0,
        rawLandmarks[vB]?.visibility ?? 0,
        rawLandmarks[vC]?.visibility ?? 0,
      );
      const visible = vis >= VISIBILITY_THRESHOLD;
      if (bodyPartVisibleRef.current !== visible) {
        bodyPartVisibleRef.current = visible;
        setBodyPartVisible(visible);
      }

      const joints = mediapipeToSkeleton133(rawLandmarks);

      if (joints) {
        const ctx = canvas.getContext("2d");
        if (ctx) drawSkeleton(ctx, joints, canvas.width, canvas.height);

        // Only treat the joint angle as meaningful when the relevant body
        // part is actually in frame; otherwise null it out so the UI hides
        // the readout and ROM aggregates don't get polluted.
        const angle = visible ? estimateKneeAngle(joints) : 0;
        setKneeAngle(visible ? angle : null);

        // Track ROM aggregates for session persistence.
        if (visible && angle > 0) {
          if (angle > maxAngleRef.current) maxAngleRef.current = angle;
          if (angle < minAngleRef.current) minAngleRef.current = angle;
        }

        // Rep counter via angle peak detection — only when this exercise
        // opted into 'angle' strategy and counting isn't paused. Hold-strategy
        // exercises increment the rep count via a separate setInterval.
        if (repStrategy === 'angle' && visible && angle > 0 && countingActiveRef.current) {
          const phase = repPhaseRef.current;
          if (angle < flexThreshold && phase !== 'flexed') {
            repPhaseRef.current = 'flexed';
          } else if (
            angle > extThreshold &&
            phase === 'flexed' &&
            now - lastRepTRef.current > REP_REFRACTORY_MS
          ) {
            repPhaseRef.current = 'extended';
            lastRepTRef.current = now;
            setRepCount(r => r + 1);
          } else if (angle > extThreshold && phase === 'unknown') {
            repPhaseRef.current = 'extended';
          }
        }

        // Buffer frames for batch inference — but only when the body part is
        // visible, otherwise the model classifies phantom skeleton data and
        // returns spurious "correct" form scores.
        if (visible) {
          skeletonBufferRef.current.push(joints);
          if (skeletonBufferRef.current.length >= SKELETON_BUFFER_SIZE) {
            const frames = skeletonBufferRef.current.splice(0, SKELETON_BUFFER_SIZE);
            if (now - lastInferenceRef.current > INFERENCE_INTERVAL_MS && isServerOnline) {
              lastInferenceRef.current = now;
              rehabApi[rehabType]
                .predictSkeleton(frames as number[][][])
                .then((pred) => {
                  setPrediction({ skeleton: pred, imu: null, timestamp: Date.now() });
                  const score = pred.correctness === "correct" ? 90 : 45;
                  setFormScore(score);
                  formScoreSumRef.current  += score;
                  formScoreCountRef.current += 1;
                })
                .catch(() => {/* server may not be running — silently ignore */});
            }
          }
        } else {
          // Drop any stale frames so the next batch only contains real
          // visible-body frames.
          skeletonBufferRef.current = [];
        }
      }
    } else {
      // No person detected at all — clear any partial state.
      if (bodyPartVisibleRef.current) {
        bodyPartVisibleRef.current = false;
        setBodyPartVisible(false);
      }
      setKneeAngle(null);
      skeletonBufferRef.current = [];
    }

    animFrameRef.current = requestAnimationFrame(detectLoop);
  }, [isServerOnline, drawSkeleton, estimateKneeAngle, rehabType, visibilityJoints, repStrategy, flexThreshold, extThreshold]);

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setStatus("initializing");
    setError(null);
    try {
      // Request a high-res 16:9 stream so the camera's full field of view is
      // captured. At 640×480 (4:3) the patient has to stand awkwardly far back
      // to fit head-to-feet in frame; 1280×720 (16:9) matches the on-screen
      // container aspect and uses the sensor's native wide FOV.
      // `ideal` (not `exact`) lets the browser fall back gracefully if the
      // camera can't deliver those numbers.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:  { ideal: 1280 },
          height: { ideal: 720  },
          aspectRatio: { ideal: 16 / 9 },
          facingMode: "user",
        },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (canvasRef.current) {
          canvasRef.current.width  = videoRef.current.videoWidth  || 640;
          canvasRef.current.height = videoRef.current.videoHeight || 480;
        }
      }

      if (!poseLandmarkerRef.current) {
        poseLandmarkerRef.current = await initPoseLandmarker();
      }

      isRunningRef.current = true;
      countingActiveRef.current = true;
      setStatus("running");
      animFrameRef.current = requestAnimationFrame(detectLoop);
      // Kick off the hold-timer for isometric / non-skeletal exercises.
      startHoldTimer();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Camera error: ${msg}`);
      setStatus("error");
    }
  }, [initPoseLandmarker, detectLoop, startHoldTimer]);

  // ── Stop camera ───────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    isRunningRef.current = false;
    stopHoldTimer();
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    skeletonBufferRef.current = [];
    bodyPartVisibleRef.current = false;
    setBodyPartVisible(null);
    setKneeAngle(null);
    setStatus("idle");
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [stopHoldTimer]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  // matchesTarget compares the model's classified exercise label against the
  // one the patient is supposed to be doing. Currently disabled — the
  // KNEE_ML_LABEL_TO_EXERCISE_ID mapping in constants.ts is known broken
  // (model was trained on REHAB24-6's arm/squat/lunge labels, not our
  // clinical knee exercises). Always returns null so the UI hides the badge.
  const matchesTarget: boolean | null = null;

  // Build live human-readable coaching messages.
  const feedback: string[] = (() => {
    const msgs: string[] = [];
    if (status !== "running") return msgs;
    // Highest-priority warning: the patient isn't actually showing the body
    // part they're supposed to be exercising. Skip all other feedback so the
    // visibility nudge is the only thing on screen.
    if (bodyPartVisible === false) {
      const bodyPart = rehabType === "elbow" ? "arm" : "leg";
      msgs.push(`Your ${bodyPart} isn't in view — step back so the full ${bodyPart} is visible to the camera. Reps won't count until it is.`);
      return msgs;
    }
    if (prediction?.skeleton?.warnings?.length) {
      msgs.push(...prediction.skeleton.warnings);
    }
    // We still surface the model's correctness assessment (smoothness /
    // movement-quality signal) since that's body-part-agnostic, but we no
    // longer claim "model thinks you're doing X" because that label is
    // meaningless against our exercise set.
    if (prediction?.skeleton?.correctness === "correct") {
      msgs.push("Form looks steady — keep the tempo controlled.");
    }
    if (kneeAngle !== null && kneeAngle > 0 && kneeAngle < 60) {
      const jointName = rehabType === "elbow" ? "Elbow" : "Knee";
      msgs.push(`${jointName} is deeply flexed — control the descent and avoid pain.`);
    }
    return msgs;
  })();

  return {
    videoRef, canvasRef,
    status, prediction, error, isServerOnline,
    startCamera, stopCamera, resetReps,
    pauseCounting, resumeCounting,
    getSessionStats,
    repCount, formScore, kneeAngle,
    matchesTarget, feedback,
  };
}
