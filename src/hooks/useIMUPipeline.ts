/**
 * useIMUPipeline
 *
 * Full IMU-based coached session hook. Mirrors useKneePipeline but drives
 * inference from a single 6-channel IMU sensor instead of a camera.
 *
 * Features:
 *  - Connects to a BLE sensor or the synthetic demo source
 *  - Accumulates a 50-sample (1 s) sliding window at 50 Hz
 *  - POSTs every window to /api/{rehabType}/imu/single for rule-based quality
 *  - Counts reps via gyro-magnitude peak detection (angle strategy) or hold
 *    timer (hold strategy)
 *  - Derives form score and live feedback from the backend response
 *  - Exposes getSessionStats() for the Firestore save at session end
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  IMUSample,
  IMUTransport,
  IMUConnectionStatus,
  IMUDeviceInfo,
  IMUSessionStats,
  RehabType,
  RepDetection,
} from "../types";
import { startDemoIMUSource, type IMUDemoController } from "../lib/imuDemoSource";
import {
  connectIMUOverBLE,
  isWebBluetoothSupported,
  type BLEIMUSession,
} from "../lib/imuBluetooth";
import { rehabApi, checkServerHealth, type IMUPrediction } from "../lib/rehabApi";
import { synthesizeKnee45ch, synthesizeLeg36ch } from "../lib/imuMultiSensorSynth";

// ── Constants ─────────────────────────────────────────────────────────────────

const SAMPLE_RATE_HZ    = 50;
const WINDOW_SIZE       = 50;    // 1-second prediction window
const SPARKLINE_LENGTH  = 40;

// Angle-based rep detection
const REP_PEAK_DPS      = 80;    // gyro magnitude (deg/s) that counts as motion
const REP_REFRACTORY_MS = 600;

// Hold-based rep detection — "still" if gyro mag below this
const STILL_THRESHOLD_DPS = 20;
const SERVER_POLL_MS      = 8_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseIMUPipelineOptions {
  rehabType: RehabType;
  repDetection?: RepDetection;
}

export interface UseIMUPipelineReturn {
  // Connection
  status: IMUConnectionStatus;
  device: IMUDeviceInfo | null;
  error: string | null;
  bluetoothSupported: boolean;
  isServerOnline: boolean;
  /** Which inference path is active: multi-sensor model or single-sensor model */
  sensorMode: 'multi' | 'single';

  // Live metrics (updated every sample at 50 Hz)
  repCount: number;
  jointAngle: number;
  rangeOfMotion: number;
  smoothness: number;
  accelSparkline: number[];
  gyroSparkline: number[];

  // ML result (updated every ~1 s)
  prediction: IMUPrediction | null;
  formScore: number | null;
  feedback: string[];

  // Session control
  connect(transport: IMUTransport): Promise<void>;
  disconnect(): Promise<void>;
  resetReps(): void;
  pauseCounting(): void;
  resumeCounting(): void;
  getSessionStats(): IMUSessionStats;
  /** Returns the most recently completed 50-sample window, or null before first window. */
  getLastWindow(): number[][] | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveFormScore(pred: IMUPrediction): number {
  const rawSmooth = pred.rehab_metrics.smoothness ?? 0.5;
  const base = Math.round(rawSmooth * 100);
  switch (pred.quality_label) {
    case "correct":      return Math.max(72, base);
    case "acceptable":   return Math.max(52, Math.min(71, base));
    case "shaky":        return Math.min(48, base);
    case "too_fast":     return Math.min(58, base);
    case "low_amplitude":return Math.min(35, base);
    default:             return base;
  }
}

function buildFeedback(pred: IMUPrediction, jointAngle: number, rom: number): string[] {
  const msgs: string[] = [];

  // Lead with backend warnings (already plain-language from Python)
  msgs.push(...pred.warnings);

  const smooth = pred.rehab_metrics.smoothness ?? 0;
  if (pred.quality_label === "correct" && smooth >= 0.7) {
    msgs.push("Excellent movement quality — keep this tempo.");
  } else if (pred.quality_label === "correct") {
    msgs.push("Form looks good — stay controlled through the full range.");
  }

  if (rom < 15 && pred.quality_label !== "low_amplitude") {
    msgs.push("Try to increase the arc of motion a little more.");
  }

  if (pred.rehab_metrics.stability != null && pred.rehab_metrics.stability < 0.45) {
    msgs.push("Keep the movement path consistent rep to rep.");
  }

  return msgs.slice(0, 4);   // cap at 4 items
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useIMUPipeline({
  rehabType,
  repDetection,
}: UseIMUPipelineOptions): UseIMUPipelineReturn {
  const [status,         setStatus]         = useState<IMUConnectionStatus>("disconnected");
  const [device,         setDevice]         = useState<IMUDeviceInfo | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [isServerOnline, setIsServerOnline] = useState(false);

  // Live metrics — updated via React state so re-renders follow 50 Hz samples.
  const [repCount,       setRepCount]       = useState(0);
  const [jointAngle,     setJointAngle]     = useState(0);
  const [rangeOfMotion,  setRangeOfMotion]  = useState(0);
  const [smoothness,     setSmoothness]     = useState(0);
  const [accelSparkline, setAccelSparkline] = useState<number[]>([]);
  const [gyroSparkline,  setGyroSparkline]  = useState<number[]>([]);

  // ML results
  const [prediction,  setPrediction]  = useState<IMUPrediction | null>(null);
  const [formScore,   setFormScore]   = useState<number | null>(null);
  const [feedback,    setFeedback]    = useState<string[]>([]);
  const [sensorMode,  setSensorMode]  = useState<'multi' | 'single'>('single');

  // Mutable refs — we never want a state update for every IMU sample.
  const demoRef           = useRef<IMUDemoController | null>(null);
  const transportRef      = useRef<IMUTransport>('demo');
  const bleRef            = useRef<BLEIMUSession | null>(null);
  const windowBufRef      = useRef<number[][]>([]);   // (WINDOW_SIZE, 6)
  const countingRef       = useRef(true);

  // Angle integrator
  const jointAngleRef     = useRef(0);
  const minAngleRef       = useRef(Infinity);
  const maxAngleRef       = useRef(-Infinity);
  const lastTimeRef       = useRef<number | null>(null);
  const lastGyroMagRef    = useRef(0);
  const jerkSumRef        = useRef(0);
  const jerkCountRef      = useRef(0);

  // Rep counter (angle strategy)
  const repCountRef       = useRef(0);
  const lastRepTRef       = useRef(-Infinity);

  // Hold rep counter
  const holdStartRef      = useRef<number | null>(null);
  const holdRepCountRef   = useRef(0);

  // Sparklines
  const accelSparkRef     = useRef<number[]>([]);
  const gyroSparkRef      = useRef<number[]>([]);

  // Snapshot for getSessionStats()
  const formScoresRef     = useRef<number[]>([]);
  const sessionRomRef     = useRef(0);
  const sessionSmoothRef  = useRef<number[]>([]);

  // Last completed window — used by callers that need raw IMU data (e.g. combined endpoint)
  const lastWindowRef     = useRef<number[][] | null>(null);

  // ── Server health poll ────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const ok = await checkServerHealth();
      if (!cancelled) setIsServerOnline(ok);
    };
    void poll();
    const t = window.setInterval(poll, SERVER_POLL_MS);
    return () => { cancelled = true; window.clearInterval(t); };
  }, []);

  // ── Reset ────────────────────────────────────────────────────────────────

  const resetIntegrator = useCallback(() => {
    windowBufRef.current     = [];
    jointAngleRef.current    = 0;
    minAngleRef.current      = Infinity;
    maxAngleRef.current      = -Infinity;
    lastTimeRef.current      = null;
    lastGyroMagRef.current   = 0;
    jerkSumRef.current       = 0;
    jerkCountRef.current     = 0;
    repCountRef.current      = 0;
    lastRepTRef.current      = -Infinity;
    holdStartRef.current     = null;
    holdRepCountRef.current  = 0;
    accelSparkRef.current    = [];
    gyroSparkRef.current     = [];
    formScoresRef.current    = [];
    sessionRomRef.current    = 0;
    sessionSmoothRef.current = [];
    setRepCount(0);
    setJointAngle(0);
    setRangeOfMotion(0);
    setSmoothness(0);
    setAccelSparkline([]);
    setGyroSparkline([]);
    setPrediction(null);
    setFormScore(null);
    setFeedback([]);
  }, []);

  const resetReps = useCallback(() => {
    repCountRef.current     = 0;
    holdRepCountRef.current = 0;
    lastRepTRef.current     = -Infinity;
    holdStartRef.current    = null;
    setRepCount(0);
  }, []);

  const pauseCounting  = useCallback(() => { countingRef.current = false; }, []);
  const resumeCounting = useCallback(() => { countingRef.current = true;  }, []);

  // ── ML window dispatch ───────────────────────────────────────────────────

  const dispatchWindow = useCallback(async (win: number[][]) => {
    try {
      let pred: IMUPrediction;
      const transport = transportRef.current;

      if (transport === 'demo' && rehabType === 'knee') {
        // Multi-sensor path: synthesize (50,6)→(50,45), UCI quality model
        const expanded = synthesizeKnee45ch(win);
        pred = await rehabApi.knee.predictIMU(expanded, SAMPLE_RATE_HZ);
        setSensorMode('multi');

      } else if (transport === 'demo' && rehabType === 'leg') {
        // Hybrid: HugaDB 36ch for exercise_type + single-sensor for quality
        const expanded = synthesizeLeg36ch(win);
        const [legPred, singlePred] = await Promise.all([
          rehabApi.leg.predictIMU(expanded, SAMPLE_RATE_HZ),
          rehabApi.leg.predictSingleIMU(win, SAMPLE_RATE_HZ),
        ]);
        // Merge: take exercise classification from the trained HugaDB model;
        // quality + metrics come from the single-sensor quality model.
        pred = {
          ...singlePred,
          exercise_type:       legPred.exercise_type,
          exercise_confidence: legPred.exercise_confidence,
          exercise_proba:      legPred.exercise_proba,
        };
        setSensorMode('multi');

      } else {
        // BLE (any body part) or elbow demo → single-sensor quality model
        pred = await rehabApi[rehabType].predictSingleIMU(win, SAMPLE_RATE_HZ);
        setSensorMode('single');
      }

      setPrediction(pred);
      const score = deriveFormScore(pred);
      setFormScore(score);
      formScoresRef.current.push(score);
      if (pred.rehab_metrics.smoothness != null) {
        sessionSmoothRef.current.push(pred.rehab_metrics.smoothness * 100);
      }
      setFeedback(buildFeedback(pred, jointAngleRef.current, sessionRomRef.current));
    } catch {
      // Network errors mid-session are non-fatal — predictions resume when server responds.
    }
  }, [rehabType]);

  // ── Sample handler ───────────────────────────────────────────────────────

  const handleSample = useCallback((s: IMUSample) => {
    const accelMag = Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az);
    const gyroMag  = Math.sqrt(s.gx * s.gx + s.gy * s.gy + s.gz * s.gz);

    // Gyro-x integration → joint angle
    if (lastTimeRef.current !== null) {
      const dtSec = Math.max(0, (s.t - lastTimeRef.current) / 1000);
      jointAngleRef.current += s.gx * dtSec;
      const dGyro = gyroMag - lastGyroMagRef.current;
      jerkSumRef.current   += dGyro * dGyro;
      jerkCountRef.current += 1;
    }
    lastTimeRef.current    = s.t;
    lastGyroMagRef.current = gyroMag;

    if (jointAngleRef.current < minAngleRef.current) minAngleRef.current = jointAngleRef.current;
    if (jointAngleRef.current > maxAngleRef.current) maxAngleRef.current = jointAngleRef.current;
    const rom = minAngleRef.current === Infinity ? 0
      : Math.abs(maxAngleRef.current - minAngleRef.current);
    if (rom > sessionRomRef.current) sessionRomRef.current = rom;

    // Rep detection
    if (countingRef.current) {
      const strategy = repDetection?.strategy ?? "angle";

      if (strategy === "angle") {
        if (
          gyroMag > REP_PEAK_DPS &&
          s.t - lastRepTRef.current > REP_REFRACTORY_MS
        ) {
          repCountRef.current += 1;
          lastRepTRef.current  = s.t;
          setRepCount(repCountRef.current);
        }
      } else {
        // Hold strategy: count one rep per holdSec of stillness
        const holdSec = repDetection?.holdSec ?? 5;
        if (gyroMag < STILL_THRESHOLD_DPS) {
          if (holdStartRef.current === null) holdStartRef.current = s.t;
          else if ((s.t - holdStartRef.current) / 1000 >= holdSec) {
            holdRepCountRef.current += 1;
            holdStartRef.current     = null;
            repCountRef.current      = holdRepCountRef.current;
            setRepCount(repCountRef.current);
          }
        } else {
          holdStartRef.current = null;
        }
      }
    }

    // Sparklines
    accelSparkRef.current.push(accelMag);
    if (accelSparkRef.current.length > SPARKLINE_LENGTH) accelSparkRef.current.shift();
    gyroSparkRef.current.push(gyroMag);
    if (gyroSparkRef.current.length > SPARKLINE_LENGTH)  gyroSparkRef.current.shift();

    // Smoothness (local jerk-based, displayed continuously)
    const jerkRms    = jerkCountRef.current > 0
      ? Math.sqrt(jerkSumRef.current / jerkCountRef.current) : 0;
    const localSmooth = Math.max(0, Math.min(100, 100 - jerkRms * 0.4));

    setJointAngle(Math.round(jointAngleRef.current * 10) / 10);
    setRangeOfMotion(Math.round(rom * 10) / 10);
    setSmoothness(Math.round(localSmooth));
    setAccelSparkline(accelSparkRef.current.slice());
    setGyroSparkline(gyroSparkRef.current.slice());

    // Accumulate window for ML
    windowBufRef.current.push([s.ax, s.ay, s.az, s.gx, s.gy, s.gz]);
    if (windowBufRef.current.length >= WINDOW_SIZE) {
      const win = windowBufRef.current.slice();
      lastWindowRef.current = win;
      windowBufRef.current = [];
      void dispatchWindow(win);
    }
  }, [repDetection, dispatchWindow]);

  // ── Connect / disconnect ─────────────────────────────────────────────────

  const cleanup = useCallback(async () => {
    demoRef.current?.stop();
    demoRef.current = null;
    if (bleRef.current) {
      try { await bleRef.current.stop(); } catch { /* swallow */ }
      bleRef.current = null;
    }
  }, []);

  const connect = useCallback(async (transport: IMUTransport) => {
    setError(null);
    transportRef.current = transport;
    await cleanup();
    resetIntegrator();
    setStatus(transport === "ble" ? "pairing" : "connecting");

    try {
      if (transport === "demo") {
        demoRef.current = startDemoIMUSource(handleSample);
        setDevice({ name: "Demo Sensor", transport: "demo", connectedAt: new Date().toISOString() });
      } else {
        const session = await connectIMUOverBLE(handleSample, (reason) => {
          setStatus("disconnected");
          setError(reason);
          setDevice(null);
          bleRef.current = null;
        });
        bleRef.current = session;
        setDevice({
          name: session.device.name ?? "IMU Sensor",
          transport: "ble",
          connectedAt: new Date().toISOString(),
        });
      }
      setStatus("streaming");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("error");
      await cleanup();
    }
  }, [cleanup, handleSample, resetIntegrator]);

  const disconnect = useCallback(async () => {
    await cleanup();
    setDevice(null);
    setStatus("disconnected");
    resetIntegrator();
  }, [cleanup, resetIntegrator]);

  useEffect(() => () => { void cleanup(); }, [cleanup]);

  // ── Session stats ────────────────────────────────────────────────────────

  const getLastWindow = useCallback((): number[][] | null => lastWindowRef.current, []);

  const getSessionStats = useCallback((): IMUSessionStats => {
    const scores = formScoresRef.current;
    const avg    = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const smoothArr = sessionSmoothRef.current;
    const avgSmooth = smoothArr.length > 0
      ? Math.round(smoothArr.reduce((a, b) => a + b, 0) / smoothArr.length) : 0;
    return {
      avgFormScore: avg,
      romDegrees:  Math.round(sessionRomRef.current * 10) / 10,
      smoothness:  avgSmooth,
    };
  }, []);

  return {
    status,
    device,
    error,
    bluetoothSupported: isWebBluetoothSupported(),
    isServerOnline,
    sensorMode,
    repCount,
    jointAngle,
    rangeOfMotion,
    smoothness,
    accelSparkline,
    gyroSparkline,
    prediction,
    formScore,
    feedback,
    connect,
    disconnect,
    resetReps,
    pauseCounting,
    resumeCounting,
    getSessionStats,
    getLastWindow,
  };
}
