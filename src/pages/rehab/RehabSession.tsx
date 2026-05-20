import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle, ArrowLeft, Camera, CheckCircle2, Loader2, Play,
  RotateCcw, Square, Target, XCircle, ChevronRight, Server,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { RehabType } from '../../types';
import {
  REHAB_MODULES, getExercisesByType, KNEE_EXERCISE_ID_TO_ML_LABEL,
} from '../../constants';
import { useKneePipeline, type SessionStats } from '../../hooks/useKneePipeline';
import { useAuth } from '../../components/AuthContext';
import { createSession } from '../../lib/sessions';
import { ExerciseDemo } from '../../components/ExerciseDemo';

function isValidRehabType(t: string | undefined): t is RehabType {
  return t === 'knee' || t === 'leg' || t === 'elbow';
}

type Stage =
  | 'brief'
  | 'running'      // doing reps
  | 'rest'         // between sets — camera still on but counting paused
  | 'countdown'    // 3-2-1 into the next set
  | 'painPrompt'
  | 'complete';

const REST_DURATION_SEC      = 20;
const COUNTDOWN_DURATION_SEC = 3;

// Snapshot of what was achieved during the running stage. Captured at the
// moment we leave 'running' so the post-session pain prompt and the
// Firestore write both work from the same numbers.
interface SessionResult {
  stats: SessionStats;
  repCount: number;
  durationSec: number;
  setsCompleted: number;
}

export function RehabSession() {
  const { type, exerciseId } = useParams<{ type: string; exerciseId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!isValidRehabType(type)) { navigate('/onboarding'); return null; }

  const mod = REHAB_MODULES[type];
  const exercise = useMemo(
    () => getExercisesByType(type).find((e) => e.id === exerciseId),
    [type, exerciseId],
  );

  if (!exercise) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">{t('common.noResults')}</p>
        <button onClick={() => navigate(`/rehab/${type}/exercises`)} className="mt-4 text-sm font-bold text-emerald-600">
          {t('session.back')}
        </button>
      </div>
    );
  }

  return <CoachedSession exercise={exercise} mod={mod} rehabType={type} onExit={() => navigate(`/rehab/${type}/exercises`)} />;
}


// ── Coached session — runs for knee, leg, and elbow ──────────────────────────
// useKneePipeline is rehab-type aware: it picks the right angle triplet,
// joint highlight, and FastAPI route from the `rehabType` arg. The hook name
// is a historical artifact of when this was knee-only.

interface CoachedSessionProps {
  exercise: ReturnType<typeof getExercisesByType>[number];
  mod: typeof REHAB_MODULES[RehabType];
  rehabType: RehabType;
  onExit: () => void;
}

function CoachedSession({ exercise, mod, rehabType, onExit }: CoachedSessionProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>('brief');
  const [currentSet, setCurrentSet] = useState(1);

  // Translated exercise content with English fallback.
  const exTitle        = t(`exerciseContent.${exercise.id}.title`,       { defaultValue: exercise.title       });
  const exDescription  = t(`exerciseContent.${exercise.id}.description`, { defaultValue: exercise.description });
  const exSafety       = t(`exerciseContent.${exercise.id}.safety`,      { defaultValue: exercise.safetyNotes });
  const exInstructions = t(`exerciseContent.${exercise.id}.instructions`, {
    returnObjects: true,
    defaultValue: exercise.instructions,
  }) as string[];
  const [elapsedSec, setElapsedSec] = useState(0);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [painLevel, setPainLevel] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Only knee exercises map cleanly to skeleton133 ML labels today; for leg
  // and elbow we leave targetMlLabel null so the hook just skips the
  // "matches target" comparison. Form scoring still runs.
  const targetMlLabel = rehabType === 'knee'
    ? (KNEE_EXERCISE_ID_TO_ML_LABEL[exercise.id] ?? null)
    : null;
  const targetReps = typeof exercise.reps === 'number' ? exercise.reps : null;

  const {
    videoRef, canvasRef,
    status, prediction, error, isServerOnline,
    startCamera, stopCamera, resetReps,
    pauseCounting, resumeCounting,
    getSessionStats,
    repCount, formScore, kneeAngle,
    feedback,
  } = useKneePipeline({ targetMlLabel, rehabType, repDetection: exercise.repDetection });

  // Visual cue when a rep counts: flash a pulse on the rep card.
  const [repFlash, setRepFlash] = useState(false);
  const prevRepRef = React.useRef(repCount);
  useEffect(() => {
    if (repCount > prevRepRef.current) {
      setRepFlash(true);
      const t = window.setTimeout(() => setRepFlash(false), 450);
      prevRepRef.current = repCount;
      return () => window.clearTimeout(t);
    }
    prevRepRef.current = repCount;
  }, [repCount]);

  // Rest / countdown timers
  const [restRemaining, setRestRemaining] = useState(0);
  const [countdownRemaining, setCountdownRemaining] = useState(0);

  // Tick the session timer.
  useEffect(() => {
    if (stage !== 'running') return;
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [stage]);

  // Auto-advance: when the rep target is hit, either finish the whole
  // session or move into the rest stage to let the user catch their breath.
  useEffect(() => {
    if (stage !== 'running' || targetReps === null) return;
    if (repCount >= targetReps) {
      if (currentSet >= exercise.sets) {
        finishRun(currentSet);
      } else {
        // Set complete → REST. Camera keeps running but counting is paused.
        pauseCounting();
        setRestRemaining(REST_DURATION_SEC);
        setStage('rest');
      }
    }
    // finishRun captures live values via refs / args; no need to depend on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repCount, targetReps, currentSet, exercise.sets, stage]);

  // Rest countdown — once it hits zero we slide into the 3-2-1 countdown.
  useEffect(() => {
    if (stage !== 'rest') return;
    if (restRemaining <= 0) {
      setCountdownRemaining(COUNTDOWN_DURATION_SEC);
      setStage('countdown');
      return;
    }
    const t = window.setTimeout(() => setRestRemaining((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [stage, restRemaining]);

  // Pre-set countdown — when it expires, advance the set and resume counting.
  useEffect(() => {
    if (stage !== 'countdown') return;
    if (countdownRemaining <= 0) {
      setCurrentSet((s) => s + 1);
      resetReps();
      resumeCounting();
      setStage('running');
      return;
    }
    const t = window.setTimeout(() => setCountdownRemaining((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [stage, countdownRemaining, resetReps, resumeCounting]);

  // Snapshot session state, stop the camera, advance to pain prompt.
  // Called from both the rep-target completion path and the manual End Session
  // button so both flows route through the same prompt + Firestore write.
  const finishRun = (setsDone: number) => {
    const stats = getSessionStats();
    setResult({
      stats,
      repCount,
      durationSec: elapsedSec,
      setsCompleted: setsDone,
    });
    stopCamera();
    setStage('painPrompt');
  };

  const handleStart = async () => {
    if (!isServerOnline) return;        // hard-blocked in the brief screen anyway
    setStage('running');
    setCurrentSet(1);
    setElapsedSec(0);
    setResult(null);
    setSaveError(null);
    resetReps();
    await startCamera();
  };

  const handleStop = () => {
    finishRun(currentSet);
  };

  const handleSavePain = async () => {
    if (!result || !user) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createSession(user.uid, {
        rehabType,
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        duration: result.durationSec,
        quality: result.stats.avgFormScore,
        painLevel,
        repCount: result.repCount,
        setsCompleted: result.setsCompleted,
        romDegrees: Math.round(result.stats.romDegrees),
      });
      setStage('complete');
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Could not save session.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = () => {
    setCurrentSet(1);
    setElapsedSec(0);
    setResult(null);
    setPainLevel(2);
    setSaveError(null);
    resetReps();
    setStage('brief');
  };

  // ── Brief stage ─────────────────────────────────────────────────────────────
  if (stage === 'brief') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={14} /> {t('session.back')}
        </button>

        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className={cn(
            'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-2',
            mod.colors.badge,
          )}>
            <Target size={12} /> {t('session.badge')}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">{exTitle}</h1>
          <p className="text-slate-500 text-sm mt-1">{exDescription}</p>
        </motion.div>

        {/* Server-offline hard block */}
        {!isServerOnline && (
          <div className="p-5 bg-red-50 border border-red-200 rounded-2xl">
            <div className="flex items-start gap-3">
              <Server size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-red-700 mb-1">{t('session.offlineTitle')}</p>
                <p className="text-sm text-red-700 leading-relaxed">
                  {t('session.offlineDesc', { cmd: 'server\\start.bat' })}
                </p>
                <p className="mt-2 text-xs text-red-600">
                  {t('session.offlineHint')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Brief card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <h2 className="font-bold text-slate-900">{t('session.briefSectionTitle')}</h2>
          </div>

          <div className="p-6 grid md:grid-cols-2 gap-6">
            {/* Reference image + Instructions */}
            <div className="space-y-4">
              <ExerciseDemo exercise={exercise} />
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t('session.howTo')}</p>
                <ol className="space-y-2">
                  {exInstructions.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-700">
                      <span className={cn(
                        'w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-extrabold mt-0.5 text-white',
                        mod.colors.primary,
                      )}>{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Targets + safety */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t('session.metrics.sets'),     value: exercise.sets },
                  { label: t('session.metrics.repsSet'),  value: exercise.reps },
                  { label: t('session.metrics.duration'), value: `${exercise.duration}${t('common.min')}` },
                ].map((m) => (
                  <div key={m.label} className={cn('p-3 rounded-xl text-center', mod.colors.light)}>
                    <p className={cn('text-lg font-extrabold', mod.colors.textDark)}>{m.value}</p>
                    <p className="text-[10px] text-slate-500">{m.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertCircle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">{exSafety}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500">{t('session.serverLabel')}</span>
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase',
                  isServerOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                )}>
                  {isServerOnline ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                  {isServerOnline ? t('session.serverOnline') : t('session.serverOffline')}
                </span>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
            <button onClick={onExit} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleStart}
              disabled={!isServerOnline}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all',
                isServerOnline
                  ? `${mod.colors.primary} ${mod.colors.primaryHover}`
                  : 'bg-slate-300 cursor-not-allowed',
              )}
            >
              <Play size={14} fill="white" />
              {isServerOnline ? t('session.startSession') : t('session.serverRequired')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pain prompt stage (gates Firestore save) ────────────────────────────────
  if (stage === 'painPrompt' && result) {
    const painColor =
      painLevel <= 3 ? 'text-emerald-600' :
      painLevel <= 6 ? 'text-amber-600'   : 'text-red-600';
    const painLabel =
      painLevel === 0 ? t('session.pain.noPain') :
      painLevel <= 3  ? t('difficulty.Beginner')    :
      painLevel <= 6  ? t('difficulty.Intermediate') : t('session.pain.severe');

    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3',
            mod.colors.light,
          )}>
            <CheckCircle2 size={28} className={mod.colors.text} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('session.pain.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {t('session.pain.description')}
          </p>
        </motion.div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          {/* Pain slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('session.pain.label')}</span>
              <span className={cn('text-3xl font-extrabold tabular-nums', painColor)}>
                {painLevel}<span className="text-base text-slate-400 font-bold">/10</span>
              </span>
            </div>
            <input
              type="range"
              min={0} max={10} step={1}
              value={painLevel}
              onChange={(e) => setPainLevel(Number(e.target.value))}
              className="w-full accent-emerald-600"
              aria-label={t('session.pain.label')}
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>{t('session.pain.noPain')}</span>
              <span className={painColor}>{painLabel}</span>
              <span>{t('session.pain.severe')}</span>
            </div>
          </div>

          {/* Session recap so the patient sees what they're saving */}
          <div className="grid grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            {[
              { label: t('session.pain.recap.setsDone'),  value: `${result.setsCompleted} / ${exercise.sets}` },
              { label: t('session.pain.recap.reps'),       value: String(result.repCount) },
              { label: t('session.pain.recap.rom'),        value: `${Math.round(result.stats.romDegrees)}°` },
              { label: t('session.pain.recap.form'),       value: result.stats.avgFormScore > 0 ? `${result.stats.avgFormScore}%` : '--' },
            ].map((m) => (
              <div key={m.label} className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                <p className="text-lg font-extrabold text-slate-900">{m.value}</p>
                <p className="text-[10px] text-slate-400">{m.label}</p>
              </div>
            ))}
          </div>

          {saveError && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={handleSavePain}
              disabled={saving}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all',
                mod.colors.primary, mod.colors.primaryHover,
                saving && 'opacity-60 cursor-not-allowed',
              )}
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> {t('session.pain.saving')}</> : <>{t('session.pain.save')} <ChevronRight size={14} /></>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Complete stage ──────────────────────────────────────────────────────────
  if (stage === 'complete' && result) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
            mod.colors.light,
          )}>
            <CheckCircle2 size={32} className={mod.colors.text} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('session.complete.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{exTitle}</p>
        </motion.div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: t('session.complete.recap.setsDone'), value: `${result.setsCompleted} / ${exercise.sets}` },
              { label: t('session.complete.recap.reps'),     value: String(result.repCount) },
              { label: t('session.complete.recap.duration'), value: `${Math.floor(result.durationSec / 60)}:${String(result.durationSec % 60).padStart(2, '0')}` },
              { label: t('session.complete.recap.rom'),      value: `${Math.round(result.stats.romDegrees)}°` },
              { label: t('session.complete.recap.form'),     value: result.stats.avgFormScore > 0 ? `${result.stats.avgFormScore}%` : '--' },
            ].map((m) => (
              <div key={m.label} className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                <p className="text-lg font-extrabold text-slate-900">{m.value}</p>
                <p className="text-[10px] text-slate-400">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button onClick={handleRestart} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">
              <RotateCcw size={14} /> {t('session.complete.restart')}
            </button>
            <button onClick={onExit} className={cn(
              'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white shadow-sm',
              mod.colors.primary, mod.colors.primaryHover,
            )}>
              {t('session.complete.done')} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Running stage ───────────────────────────────────────────────────────────
  const initializing = status === 'initializing';

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('session.running.label')}</p>
          <h1 className="text-xl font-extrabold text-slate-900">{exTitle}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={cn(
            'px-3 py-1.5 rounded-full text-xs font-bold',
            mod.colors.badge,
          )}>
            {t('session.running.set', { current: currentSet, total: exercise.sets })}
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
            {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')}
          </span>
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white"
          >
            <Square size={12} fill="white" /> {t('session.running.stop')}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Camera column */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5">
            {error && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-sm text-red-700">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
            <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-video">
              {initializing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                  <Loader2 size={32} className="text-emerald-400 animate-spin" />
                  <p className="text-sm font-bold text-slate-300">{t('ml.camera.loadingTitle')}</p>
                </div>
              )}
              <video
                ref={videoRef as React.RefObject<HTMLVideoElement>}
                className="absolute inset-0 w-full h-full object-contain"
                playsInline muted
              />
              {/* object-contain on the canvas keeps the skeleton overlay
                  aligned with the (possibly letterboxed) video — the
                  drawing surface stays at videoWidth × videoHeight, and
                  CSS scales it identically to how the video element is
                  scaled. Without this, the skeleton would stretch into
                  the black bars when the camera returns 4:3. */}
              <canvas
                ref={canvasRef as React.RefObject<HTMLCanvasElement>}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />
              {status === 'running' && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-red-500 rounded-full text-xs font-bold text-white shadow">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {t('ml.camera.liveBadge')}
                </div>
              )}
              {/* The "Matching target exercise" badge has been hidden until
                  the KNEE_ML_LABEL_TO_EXERCISE_ID mapping is fixed —
                  the underlying check compares model labels (REHAB24-6's
                  arm/squat/lunge labels) against our clinical knee exercise
                  IDs, which can never agree. See the warning comment in
                  src/constants.ts above KNEE_ML_LABEL_TO_EXERCISE_ID. */}
              {!initializing && status !== 'running' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                  <Camera size={36} className="text-slate-700" />
                  <p className="text-sm text-slate-500">{t('ml.camera.inactiveTitle')}</p>
                </div>
              )}

              {/* Rest-period overlay — shown between sets so the user knows
                  the set was completed and roughly how long until the next. */}
              <AnimatePresence>
                {stage === 'rest' && (
                  <motion.div
                    key="rest"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20"
                  >
                    <div className={cn(
                      'inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-3',
                      mod.colors.badge,
                    )}>
                      <CheckCircle2 size={12} /> {t('session.rest.complete', { current: currentSet })}
                    </div>
                    <p className="text-xs text-slate-300 mb-1 uppercase tracking-widest font-bold">{t('session.rest.label')}</p>
                    <p className="text-7xl font-extrabold tabular-nums">{restRemaining}</p>
                    <p className="text-xs text-slate-300 mt-3">{t('session.rest.next', { next: currentSet + 1, total: exercise.sets })}</p>
                    <button
                      onClick={() => setRestRemaining(0)}
                      className="mt-5 px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
                    >
                      {t('session.rest.skip')}
                    </button>
                  </motion.div>
                )}
                {stage === 'countdown' && (
                  <motion.div
                    key="countdown"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20"
                  >
                    <p className="text-xs text-slate-300 mb-2 uppercase tracking-widest font-bold">{t('session.countdown.label')}</p>
                    <motion.p
                      key={countdownRemaining}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.25 }}
                      className={cn('text-8xl font-extrabold tabular-nums', mod.colors.text)}
                    >
                      {countdownRemaining}
                    </motion.p>
                    <p className="text-xs text-slate-300 mt-3">{t('session.countdown.next', { next: currentSet + 1 })}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Metric strip — Reps card pulses + tints with the accent
                color each time the counter increments, so the user gets
                clear visual confirmation that a rep landed. */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <motion.div
                animate={repFlash
                  ? { scale: [1, 1.08, 1] }
                  : { scale: 1 }}
                transition={{ duration: 0.4 }}
                className={cn(
                  'p-3 rounded-xl text-center border transition-colors',
                  repFlash ? cn(mod.colors.light, mod.colors.border) : 'bg-slate-50 border-slate-100',
                )}
              >
                <p className="text-xs text-slate-400 font-medium mb-1">{t('session.running.reps')}</p>
                <p className={cn(
                  'text-lg font-extrabold transition-colors',
                  repFlash ? mod.colors.textDark : 'text-slate-900',
                )}>
                  {repCount}{targetReps ? ` / ${targetReps}` : ''}
                </p>
              </motion.div>
              {[
                { label: rehabType === 'elbow' ? t('session.running.elbowAngle') : t('session.running.kneeAngle'), value: kneeAngle !== null ? `${kneeAngle}°` : '--' },
                { label: t('session.running.formScore'),    value: formScore !== null ? `${formScore}%` : '--' },
                { label: t('session.running.correctness'),  value: prediction?.skeleton?.correctness ?? '--' },
              ].map((m) => (
                <div key={m.label} className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                  <p className="text-xs text-slate-400 font-medium mb-1">{m.label}</p>
                  <p className={cn(
                    'text-lg font-extrabold',
                    m.value === '--' ? 'text-slate-300' : 'text-slate-900',
                  )}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Instructions + feedback column */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t('session.running.instructionsLabel')}</p>
            <ol className="space-y-2">
              {exInstructions.map((step, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-700">
                  <span className={cn(
                    'w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-extrabold text-white',
                    mod.colors.primary,
                  )}>{i + 1}</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className={cn(
            'rounded-2xl border p-5 shadow-sm',
            feedback.length === 0
              ? 'bg-slate-50 border-slate-200'
              : 'bg-emerald-50 border-emerald-200',
          )}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-slate-500">{t('session.running.feedbackLabel')}</p>
            <AnimatePresence mode="popLayout">
              {feedback.length === 0 ? (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-xs text-slate-500 italic"
                >
                  {t('session.running.feedbackEmpty')}
                </motion.p>
              ) : (
                <motion.ul
                  key="msgs"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {feedback.map((msg, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
                      <ChevronRight size={14} className="flex-shrink-0 mt-0.5 text-slate-400" />
                      <span>{msg}</span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
