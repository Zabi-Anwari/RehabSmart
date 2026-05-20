import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity, AlertCircle, ArrowLeft, Bluetooth, BluetoothConnected,
  CheckCircle2, ChevronRight, Cpu, Loader2, Play, RotateCcw,
  Square, Target, Wifi, WifiOff, XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { RehabType } from '../../types';
import { REHAB_MODULES, getExercisesByType } from '../../constants';
import { useIMUPipeline } from '../../hooks/useIMUPipeline';
import { useAuth } from '../../components/AuthContext';
import { createSession } from '../../lib/sessions';
import { ExerciseDemo } from '../../components/ExerciseDemo';
import { IMUBodyView3D } from '../../components/IMUBodyView3D';

function isValidRehabType(t: string | undefined): t is RehabType {
  return t === 'knee' || t === 'leg' || t === 'elbow';
}

type Stage =
  | 'brief'
  | 'running'
  | 'rest'
  | 'countdown'
  | 'painPrompt'
  | 'complete';

const REST_DURATION_SEC      = 20;
const COUNTDOWN_DURATION_SEC = 3;

interface SessionResult {
  avgFormScore: number;
  repCount: number;
  romDegrees: number;
  smoothness: number;
  durationSec: number;
  setsCompleted: number;
}

export function IMUSession() {
  const { type, exerciseId } = useParams<{ type: string; exerciseId: string }>();
  const navigate = useNavigate();

  if (!isValidRehabType(type)) { navigate('/onboarding'); return null; }

  const mod = REHAB_MODULES[type];
  const exercise = useMemo(
    () => getExercisesByType(type).find((e) => e.id === exerciseId),
    [type, exerciseId],
  );

  if (!exercise) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Exercise not found.</p>
        <button onClick={() => navigate(`/rehab/${type}/exercises`)} className="mt-4 text-sm font-bold text-emerald-600">
          Back to exercises
        </button>
      </div>
    );
  }

  return (
    <IMUCoachedSession
      exercise={exercise}
      mod={mod}
      rehabType={type}
      onExit={() => navigate(`/rehab/${type}/exercises`)}
    />
  );
}


// ── IMU Coached Session ───────────────────────────────────────────────────────

interface IMUCoachedSessionProps {
  exercise: ReturnType<typeof getExercisesByType>[number];
  mod: typeof REHAB_MODULES[RehabType];
  rehabType: RehabType;
  onExit: () => void;
}

function IMUCoachedSession({ exercise, mod, rehabType, onExit }: IMUCoachedSessionProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [stage, setStage]         = useState<Stage>('brief');
  const [currentSet, setCurrentSet] = useState(1);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [result, setResult]         = useState<SessionResult | null>(null);
  const [painLevel, setPainLevel]   = useState(2);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [restRemaining, setRestRemaining]       = useState(0);
  const [countdownRemaining, setCountdownRemaining] = useState(0);

  const exTitle        = t(`exerciseContent.${exercise.id}.title`,       { defaultValue: exercise.title       });
  const exDescription  = t(`exerciseContent.${exercise.id}.description`, { defaultValue: exercise.description });
  const exSafety       = t(`exerciseContent.${exercise.id}.safety`,      { defaultValue: exercise.safetyNotes });
  const exInstructions = t(`exerciseContent.${exercise.id}.instructions`, {
    returnObjects: true,
    defaultValue: exercise.instructions,
  }) as string[];

  const targetReps = typeof exercise.reps === 'number' ? exercise.reps : null;

  const {
    status, device, error, bluetoothSupported, isServerOnline,
    repCount, jointAngle, rangeOfMotion, smoothness,
    accelSparkline, gyroSparkline,
    prediction, formScore, feedback,
    connect, disconnect,
    resetReps, pauseCounting, resumeCounting, getSessionStats,
  } = useIMUPipeline({ rehabType, repDetection: exercise.repDetection });

  // Flash effect on new rep
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

  // Session timer
  useEffect(() => {
    if (stage !== 'running') return;
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [stage]);

  // Auto-advance on rep target
  useEffect(() => {
    if (stage !== 'running' || targetReps === null) return;
    if (repCount >= targetReps) {
      if (currentSet >= exercise.sets) {
        finishRun(currentSet);
      } else {
        pauseCounting();
        setRestRemaining(REST_DURATION_SEC);
        setStage('rest');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repCount, targetReps, currentSet, exercise.sets, stage]);

  // Rest countdown
  useEffect(() => {
    if (stage !== 'rest') return;
    if (restRemaining <= 0) { setCountdownRemaining(COUNTDOWN_DURATION_SEC); setStage('countdown'); return; }
    const t = window.setTimeout(() => setRestRemaining((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [stage, restRemaining]);

  // Pre-set countdown
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

  const finishRun = (setsDone: number) => {
    const stats = getSessionStats();
    setResult({
      avgFormScore:  stats.avgFormScore,
      repCount,
      romDegrees:   stats.romDegrees,
      smoothness:   stats.smoothness,
      durationSec:  elapsedSec,
      setsCompleted: setsDone,
    });
    void disconnect();
    setStage('painPrompt');
  };

  const handleStart = async () => {
    setStage('running');
    setCurrentSet(1);
    setElapsedSec(0);
    setResult(null);
    setSaveError(null);
    resetReps();
  };

  const handleStop = () => finishRun(currentSet);

  const handleSavePain = async () => {
    if (!result || !user) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createSession(user.uid, {
        rehabType,
        exerciseId:    exercise.id,
        exerciseTitle: exercise.title,
        duration:      result.durationSec,
        quality:       result.avgFormScore,
        painLevel,
        repCount:      result.repCount,
        setsCompleted: result.setsCompleted,
        romDegrees:    Math.round(result.romDegrees),
      });
      setStage('complete');
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Could not save session.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = () => {
    setCurrentSet(1); setElapsedSec(0);
    setResult(null); setPainLevel(2); setSaveError(null);
    resetReps(); setStage('brief');
  };

  // ── Brief stage ─────────────────────────────────────────────────────────────
  if (stage === 'brief') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <button onClick={onExit} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> {t('session.back')}
        </button>

        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-2', mod.colors.badge)}>
            <Target size={12} /> IMU Session
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">{exTitle}</h1>
          <p className="text-slate-500 text-sm mt-1">{exDescription}</p>
        </motion.div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <h2 className="font-bold text-slate-900">{t('session.briefSectionTitle')}</h2>
          </div>

          <div className="p-6 grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <ExerciseDemo exercise={exercise} />
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t('session.howTo')}</p>
                <ol className="space-y-2">
                  {exInstructions.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-700">
                      <span className={cn('w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-extrabold mt-0.5 text-white', mod.colors.primary)}>{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

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

              {/* IMU connection panel */}
              <IMUConnectPanel
                status={status}
                device={device}
                error={error}
                bluetoothSupported={bluetoothSupported}
                isServerOnline={isServerOnline}
                mod={mod}
                onConnect={connect}
                onDisconnect={disconnect}
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
            <button onClick={onExit} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleStart}
              disabled={status !== 'streaming' || !isServerOnline}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all',
                status === 'streaming' && isServerOnline
                  ? `${mod.colors.primary} ${mod.colors.primaryHover}`
                  : 'bg-slate-300 cursor-not-allowed',
              )}
            >
              <Play size={14} fill="white" />
              {status !== 'streaming' ? 'Connect IMU to start' : !isServerOnline ? t('session.serverRequired') : t('session.startSession')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pain prompt ──────────────────────────────────────────────────────────────
  if (stage === 'painPrompt' && result) {
    const painColor = painLevel <= 3 ? 'text-emerald-600' : painLevel <= 6 ? 'text-amber-600' : 'text-red-600';
    const painLabel = painLevel === 0 ? t('session.pain.noPain') : painLevel <= 3 ? t('difficulty.Beginner') : painLevel <= 6 ? t('difficulty.Intermediate') : t('session.pain.severe');

    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3', mod.colors.light)}>
            <CheckCircle2 size={28} className={mod.colors.text} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('session.pain.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('session.pain.description')}</p>
        </motion.div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('session.pain.label')}</span>
              <span className={cn('text-3xl font-extrabold tabular-nums', painColor)}>
                {painLevel}<span className="text-base text-slate-400 font-bold">/10</span>
              </span>
            </div>
            <input type="range" min={0} max={10} step={1} value={painLevel}
              onChange={(e) => setPainLevel(Number(e.target.value))}
              className="w-full accent-emerald-600" aria-label={t('session.pain.label')} />
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>{t('session.pain.noPain')}</span>
              <span className={painColor}>{painLabel}</span>
              <span>{t('session.pain.severe')}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            {[
              { label: t('session.pain.recap.setsDone'), value: `${result.setsCompleted} / ${exercise.sets}` },
              { label: t('session.pain.recap.reps'),      value: String(result.repCount) },
              { label: t('session.pain.recap.rom'),       value: `${Math.round(result.romDegrees)}°` },
              { label: t('session.pain.recap.form'),      value: result.avgFormScore > 0 ? `${result.avgFormScore}%` : '--' },
            ].map((m) => (
              <div key={m.label} className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                <p className="text-lg font-extrabold text-slate-900">{m.value}</p>
                <p className="text-[10px] text-slate-400">{m.label}</p>
              </div>
            ))}
          </div>

          {saveError && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{saveError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button onClick={handleSavePain} disabled={saving}
              className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all',
                mod.colors.primary, mod.colors.primaryHover, saving && 'opacity-60 cursor-not-allowed')}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> {t('session.pain.saving')}</> : <>{t('session.pain.save')} <ChevronRight size={14} /></>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Complete stage ────────────────────────────────────────────────────────────
  if (stage === 'complete' && result) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4', mod.colors.light)}>
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
              { label: t('session.complete.recap.rom'),      value: `${Math.round(result.romDegrees)}°` },
              { label: t('session.complete.recap.form'),     value: result.avgFormScore > 0 ? `${result.avgFormScore}%` : '--' },
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
            <button onClick={onExit} className={cn('flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white shadow-sm', mod.colors.primary, mod.colors.primaryHover)}>
              {t('session.complete.done')} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Running stage ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('session.running.label')} · IMU</p>
          <h1 className="text-xl font-extrabold text-slate-900">{exTitle}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={cn('px-3 py-1.5 rounded-full text-xs font-bold', mod.colors.badge)}>
            {t('session.running.set', { current: currentSet, total: exercise.sets })}
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
            {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')}
          </span>
          {/* Sensor status badge */}
          <span className={cn('hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase',
            status === 'streaming' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
            {status === 'streaming'
              ? <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live</>
              : <><AlertCircle size={10} /> {status}</>}
          </span>
          <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white">
            <Square size={12} fill="white" /> {t('session.running.stop')}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* IMU visualisation column */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5">
            {error && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-sm text-red-700">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
              </div>
            )}

            {/* 3D body visualisation */}
            <IMUBodyView3D
              rehabType={rehabType}
              jointAngle={jointAngle}
              rangeOfMotion={rangeOfMotion}
              isStreaming={status === 'streaming'}
            >
              <AnimatePresence>
                {stage === 'rest' && (
                  <motion.div key="rest" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                    <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-3', mod.colors.badge)}>
                      <CheckCircle2 size={12} /> {t('session.rest.complete', { current: currentSet })}
                    </div>
                    <p className="text-xs text-slate-300 mb-1 uppercase tracking-widest font-bold">{t('session.rest.label')}</p>
                    <p className="text-7xl font-extrabold tabular-nums">{restRemaining}</p>
                    <p className="text-xs text-slate-300 mt-3">{t('session.rest.next', { next: currentSet + 1, total: exercise.sets })}</p>
                    <button onClick={() => setRestRemaining(0)} className="mt-5 px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors">
                      {t('session.rest.skip')}
                    </button>
                  </motion.div>
                )}
                {stage === 'countdown' && (
                  <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                    <p className="text-xs text-slate-300 mb-2 uppercase tracking-widest font-bold">{t('session.countdown.label')}</p>
                    <motion.p key={countdownRemaining} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.25 }}
                      className={cn('text-8xl font-extrabold tabular-nums', mod.colors.text)}>
                      {countdownRemaining}
                    </motion.p>
                    <p className="text-xs text-slate-300 mt-3">{t('session.countdown.next', { next: currentSet + 1 })}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </IMUBodyView3D>

            {/* Sparklines */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Sparkline values={accelSparkline} label="Accel" color="#34d399" />
              <Sparkline values={gyroSparkline}  label="Gyro"  color="#60a5fa" />
            </div>

            {/* Metric strip */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <motion.div
                animate={repFlash ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.4 }}
                className={cn('p-3 rounded-xl text-center border transition-colors',
                  repFlash ? cn(mod.colors.light, mod.colors.border) : 'bg-slate-50 border-slate-100')}>
                <p className="text-xs text-slate-400 font-medium mb-1">{t('session.running.reps')}</p>
                <p className={cn('text-lg font-extrabold transition-colors', repFlash ? mod.colors.textDark : 'text-slate-900')}>
                  {repCount}{targetReps ? ` / ${targetReps}` : ''}
                </p>
              </motion.div>

              {[
                { label: 'Angle', value: `${Math.round(jointAngle)}°` },
                { label: 'Form', value: formScore !== null ? `${formScore}%` : '--' },
                { label: 'Smooth', value: `${smoothness}%` },
              ].map((m) => (
                <div key={m.label} className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                  <p className="text-xs text-slate-400 font-medium mb-1">{m.label}</p>
                  <p className={cn('text-lg font-extrabold', m.value === '--' ? 'text-slate-300' : 'text-slate-900')}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Quality badge from ML */}
            {prediction && prediction.quality_label !== 'single_sensor' && (
              <div className={cn('mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold',
                prediction.quality_label === 'correct' ? 'bg-emerald-100 text-emerald-700'
                : prediction.quality_label === 'acceptable' ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700')}>
                <Activity size={11} />
                {prediction.quality_label === 'correct' ? 'Good form'
                  : prediction.quality_label === 'acceptable' ? 'Acceptable'
                  : prediction.quality_label === 'shaky' ? 'Too jerky'
                  : prediction.quality_label === 'too_fast' ? 'Too fast'
                  : prediction.quality_label === 'low_amplitude' ? 'Low amplitude'
                  : prediction.quality_label}
              </div>
            )}
          </div>
        </div>

        {/* Instructions + feedback column */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t('session.running.instructionsLabel')}</p>
            <ol className="space-y-2">
              {exInstructions.map((step, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-700">
                  <span className={cn('w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-extrabold text-white', mod.colors.primary)}>{i + 1}</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className={cn('rounded-2xl border p-5 shadow-sm',
            feedback.length === 0 ? 'bg-slate-50 border-slate-200' : 'bg-emerald-50 border-emerald-200')}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-slate-500">{t('session.running.feedbackLabel')}</p>
            <AnimatePresence mode="popLayout">
              {feedback.length === 0 ? (
                <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-xs text-slate-500 italic">
                  {t('session.running.feedbackEmpty')}
                </motion.p>
              ) : (
                <motion.ul key="msgs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
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


// ── IMU Connection Panel ──────────────────────────────────────────────────────

interface IMUConnectPanelProps {
  status: string;
  device: { name: string; transport: string } | null;
  error: string | null;
  bluetoothSupported: boolean;
  isServerOnline: boolean;
  mod: typeof REHAB_MODULES[RehabType];
  onConnect: (t: 'ble' | 'demo') => Promise<void>;
  onDisconnect: () => Promise<void>;
}

function IMUConnectPanel({
  status, device, error, bluetoothSupported, isServerOnline,
  mod, onConnect, onDisconnect,
}: IMUConnectPanelProps) {
  const connecting = status === 'pairing' || status === 'connecting';

  if (status === 'streaming' && device) {
    return (
      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
        <BluetoothConnected size={16} className="text-emerald-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-700 truncate">{device.name}</p>
          <p className="text-[10px] text-emerald-600 uppercase tracking-widest font-bold">Streaming · {device.transport}</p>
        </div>
        <button onClick={onDisconnect} className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Connect IMU Sensor</p>

      {!isServerOnline && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          <WifiOff size={13} className="flex-shrink-0" />
          ML server offline — start FastAPI before connecting.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          <XCircle size={13} className="flex-shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onConnect('ble')}
          disabled={connecting || !bluetoothSupported}
          className={cn(
            'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all',
            connecting || !bluetoothSupported
              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
              : 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100',
          )}
        >
          {connecting && status === 'pairing'
            ? <Loader2 size={13} className="animate-spin" />
            : <Bluetooth size={13} />}
          BLE Sensor
        </button>

        <button
          onClick={() => onConnect('demo')}
          disabled={connecting}
          className={cn(
            'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all',
            connecting
              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
              : `border-current ${mod.colors.text} ${mod.colors.light} hover:opacity-90`,
          )}
        >
          {connecting && status === 'connecting'
            ? <Loader2 size={13} className="animate-spin" />
            : <Cpu size={13} />}
          Demo Sensor
        </button>
      </div>

      {!bluetoothSupported && (
        <p className="text-[10px] text-slate-400 text-center">BLE requires Chrome/Edge on HTTPS or localhost.</p>
      )}
    </div>
  );
}


// ── Mini sparkline component ──────────────────────────────────────────────────

function Sparkline({ values, label, color }: { values: number[]; label: string; color: string }) {
  if (values.length < 2) {
    return (
      <div className="bg-slate-800 rounded-xl p-3 h-16 flex items-center justify-center">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{label}</p>
      </div>
    );
  }

  const max  = Math.max(...values, 0.01);
  const w    = 120;
  const h    = 40;
  const pts  = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="bg-slate-800 rounded-xl p-3">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{label}</p>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
