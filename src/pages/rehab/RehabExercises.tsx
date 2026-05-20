import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Dumbbell, Play, Camera, Cpu, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Clock, BarChart2, Loader2, Activity, XCircle,
  Bluetooth,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { RehabType, Exercise } from '../../types';
import { REHAB_MODULES, getExercisesByType } from '../../constants';
import { rehabApi } from '../../lib/rehabApi';
import { ExerciseDemo } from '../../components/ExerciseDemo';

// Live status panel that replaces the old static "Coming Soon" notice.
// Pings the FastAPI server's per-type /health endpoint and reflects what
// will actually happen when the patient starts a coached session.
function MLStatusPanel({ rehabType, mod }: {
  rehabType: RehabType;
  mod: typeof REHAB_MODULES[RehabType];
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const moduleLabel = t(`rehab.${rehabType}`);

  useEffect(() => {
    let cancelled = false;
    setStatus('checking');
    rehabApi[rehabType].health()
      .then(() => { if (!cancelled) setStatus('online'); })
      .catch(() => { if (!cancelled) setStatus('offline'); });
    return () => { cancelled = true; };
  }, [rehabType]);

  if (status === 'checking') {
    return (
      <div className="flex items-start gap-3 p-4 bg-slate-900 rounded-2xl border border-slate-800">
        <Loader2 size={16} className="text-slate-500 animate-spin mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white mb-1">{t('exercises.ml.checking')}</p>
          <p className="text-xs text-slate-400">
            {t('exercises.ml.checkingDesc', { module: moduleLabel })}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div className="flex items-start gap-3 p-4 bg-red-950/90 rounded-2xl border border-red-900">
        <XCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white mb-1">{t('exercises.ml.offlineTitle')}</p>
          <p className="text-xs text-red-200/80 leading-relaxed mb-2">
            {t('exercises.ml.offlineDesc', { cmd: 'server\\start.bat' })}
          </p>
        </div>
        <span className="px-2 py-1 bg-red-900/60 rounded-full text-[10px] font-bold text-red-300 uppercase tracking-widest flex-shrink-0">
          {t('exercises.ml.offlineBadge')}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-slate-900 rounded-2xl border border-emerald-900/60">
      <div className="relative mt-1.5 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]" />
        <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-60" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-white mb-1 flex items-center gap-2">
          {t('exercises.ml.onlineTitle')}
          <Activity size={13} className="text-emerald-400" />
        </p>
        <p className="text-xs text-slate-400 leading-relaxed">
          {t('exercises.ml.onlineDesc', { module: moduleLabel })}
        </p>
      </div>
      <span className="px-2 py-1 bg-emerald-900/40 rounded-full text-[10px] font-bold text-emerald-300 uppercase tracking-widest flex-shrink-0">
        {t('exercises.ml.onlineBadge')}
      </span>
    </div>
  );
}

function isValidRehabType(t: string | undefined): t is RehabType {
  return t === 'knee' || t === 'leg' || t === 'elbow';
}

const DIFFICULTY_ORDER = ['Beginner', 'Intermediate', 'Advanced'] as const;
type Difficulty = typeof DIFFICULTY_ORDER[number];

function ExerciseCard({ exercise, colors, defaultOpen = false, onStart, onStartIMU }: {
  exercise: Exercise;
  colors: typeof REHAB_MODULES[RehabType]['colors'];
  defaultOpen?: boolean;
  onStart: (ex: Exercise) => void;
  onStartIMU: (ex: Exercise) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  const diffColor: Record<Difficulty, string> = {
    Beginner: 'bg-green-100 text-green-700',
    Intermediate: 'bg-amber-100 text-amber-700',
    Advanced: 'bg-red-100 text-red-600',
  };

  // Translated exercise content. Falls back to the English text in
  // constants.ts if the locale doesn't have an entry for this exercise.
  const exTitle        = t(`exerciseContent.${exercise.id}.title`,       { defaultValue: exercise.title       });
  const exDescription  = t(`exerciseContent.${exercise.id}.description`, { defaultValue: exercise.description });
  const exSafety       = t(`exerciseContent.${exercise.id}.safety`,      { defaultValue: exercise.safetyNotes });
  const exInstructions = t(`exerciseContent.${exercise.id}.instructions`, {
    returnObjects: true,
    defaultValue: exercise.instructions,
  }) as string[];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Card header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left"
      >
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', colors.light)}>
          <Dumbbell size={20} className={colors.text} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-slate-900 text-sm">{exTitle}</h3>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', diffColor[exercise.difficulty])}>
              {t(`difficulty.${exercise.difficulty}`)}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
              {t('phases.phaseShort', { n: exercise.phase })}
            </span>
          </div>
          <p className="text-xs text-slate-500 line-clamp-1">{exDescription}</p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 text-right">
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-slate-900">{exercise.sets} × {exercise.reps}</p>
            <p className="text-[10px] text-slate-400">{t('exercises.sets').toLowerCase()} × {t('exercises.reps').toLowerCase()}</p>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-slate-900">{exercise.duration} {t('common.min')}</p>
            <p className="text-[10px] text-slate-400">{t('exercises.duration').toLowerCase()}</p>
          </div>
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 border-t border-slate-100 pt-5 grid md:grid-cols-2 gap-6">
              {/* Reference image + Instructions */}
              <div className="space-y-4">
                <ExerciseDemo exercise={exercise} />
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t('exercises.instructions')}</p>
                  <ol className="space-y-2">
                    {exInstructions.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm text-slate-600">
                        <span className={cn(
                          'w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-extrabold mt-0.5 text-white',
                          colors.primary
                        )}>
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Metrics + Safety */}
              <div className="space-y-4">
                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: t('exercises.sets'),     value: exercise.sets,                  icon: BarChart2    },
                    { label: t('exercises.reps'),     value: exercise.reps,                  icon: CheckCircle2 },
                    { label: t('exercises.duration'), value: `${exercise.duration}${t('common.min')}`, icon: Clock        },
                  ].map((m) => (
                    <div key={m.label} className={cn('p-3 rounded-xl text-center', colors.light)}>
                      <m.icon size={14} className={cn('mx-auto mb-1', colors.text)} />
                      <p className={cn('text-sm font-extrabold', colors.textDark)}>{m.value}</p>
                      <p className="text-[10px] text-slate-400">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Safety note */}
                <div className="flex gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">{exSafety}</p>
                </div>

                {/* Start coached session */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onStart(exercise); }}
                    className={cn(
                      'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all',
                      colors.primary, colors.primaryHover,
                    )}
                  >
                    <Camera size={13} />
                    Camera
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onStartIMU(exercise); }}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all"
                  >
                    <Bluetooth size={13} />
                    IMU Sensor
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  {t('exercises.cardCtaHint')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RehabExercises() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [filterPhase, setFilterPhase] = useState<number | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | null>(null);

  if (!isValidRehabType(type)) {
    navigate('/onboarding');
    return null;
  }

  const mod = REHAB_MODULES[type];
  const { colors } = mod;
  const allExercises = getExercisesByType(type);

  const startSession    = (ex: Exercise) => navigate(`/rehab/${type}/session/${ex.id}`);
  const startIMUSession = (ex: Exercise) => navigate(`/rehab/${type}/imu-session/${ex.id}`);

  const filtered = allExercises.filter(ex => {
    if (filterPhase !== null && ex.phase !== filterPhase) return false;
    if (filterDifficulty !== null && ex.difficulty !== filterDifficulty) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-2', colors.badge)}>
          <Dumbbell size={12} />
          {t('exercises.badge')}
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">{t('exercises.title', { module: t(`rehab.${type}`) })}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {t('exercises.description', { count: allExercises.length })}
        </p>
      </motion.div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('exercises.filter.label')}</span>

        {/* Phase filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">{t('exercises.filter.phase')}</span>
          {[null, 1, 2, 3, 4].map((p) => (
            <button
              key={String(p)}
              onClick={() => setFilterPhase(p as number | null)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-bold transition-all',
                filterPhase === p
                  ? `${colors.primary} text-white`
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              )}
            >
              {p === null ? t('common.all') : `P${p}`}
            </button>
          ))}
        </div>

        {/* Difficulty filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">{t('exercises.filter.level')}</span>
          {[null, ...DIFFICULTY_ORDER].map((d) => (
            <button
              key={String(d)}
              onClick={() => setFilterDifficulty(d as Difficulty | null)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-bold transition-all',
                filterDifficulty === d
                  ? `${colors.primary} text-white`
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              )}
            >
              {d ? t(`difficulty.${d}`) : t('common.all')}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-slate-400">{t('exercises.filter.count', { count: filtered.length })}</span>
      </div>

      {/* Live ML pipeline status — pings the FastAPI server on mount. */}
      <MLStatusPanel rehabType={type} mod={mod} />

      {/* Exercise list */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Dumbbell size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t('exercises.empty')}</p>
          </div>
        ) : (
          filtered.map((exercise, i) => (
            <motion.div
              key={exercise.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <ExerciseCard
                exercise={exercise}
                colors={mod.colors as any}
                defaultOpen={i === 0}
                onStart={startSession}
                onStartIMU={startIMUSession}
              />
            </motion.div>
          ))
        )}
      </div>

      {/* Start session CTA */}
      <div className={cn('p-6 rounded-2xl border text-center', colors.light, colors.border)}>
        <Dumbbell size={28} className={cn('mx-auto mb-3', colors.text)} />
        <p className={cn('font-bold text-lg mb-1', colors.textDark)}>{t('exercises.cta.title')}</p>
        <p className="text-sm text-slate-500 mb-4">
          {t('exercises.cta.description')}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => { if (filtered.length) startSession(filtered[0]); }}
            disabled={filtered.length === 0}
            className={cn(
              'flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white text-sm shadow-sm transition-all',
              filtered.length === 0 ? 'bg-slate-300 cursor-not-allowed' : `${colors.primary} ${colors.primaryHover}`,
            )}
          >
            <Camera size={14} />
            {t('exercises.cta.button')}
          </button>
          <button
            onClick={() => { if (filtered.length) startIMUSession(filtered[0]); }}
            disabled={filtered.length === 0}
            className={cn(
              'flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm shadow-sm transition-all border',
              filtered.length === 0
                ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100',
            )}
          >
            <Bluetooth size={14} />
            Start with IMU Sensor
          </button>
        </div>
      </div>
    </div>
  );
}
