import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList, CheckCircle2, Circle, Dumbbell, Target,
  Calendar, ChevronRight, Lock, Cpu,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { RehabType } from '../../types';
import { REHAB_MODULES, REHAB_PHASES, getExercisesByType } from '../../constants';

function isValidRehabType(t: string | undefined): t is RehabType {
  return t === 'knee' || t === 'leg' || t === 'elbow';
}

const CURRENT_PHASE: 1 | 2 | 3 | 4 = 2;

export function RehabPlan() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!isValidRehabType(type)) {
    navigate('/onboarding');
    return null;
  }

  const mod = REHAB_MODULES[type];
  const { colors } = mod;
  const phases = REHAB_PHASES[type];
  const exercises = getExercisesByType(type);

  const getExerciseTitle = (id: string) => {
    const fallback = exercises.find(e => e.id === id)?.title ?? id;
    return t(`exerciseContent.${id}.title`, { defaultValue: fallback });
  };

  const WEEKLY_SCHEDULE: { key: string; sessions: string[]; rest: boolean }[] = [
    { key: 'mon', sessions: [t('plan.schedule.title', { phase: '1 & 2' })], rest: false },
    { key: 'tue', sessions: [], rest: true },
    { key: 'wed', sessions: [t('plan.phase.exercises')], rest: false },
    { key: 'thu', sessions: [t('plan.phase.exercises')], rest: false },
    { key: 'fri', sessions: [t('plan.phase.exercises')], rest: false },
    { key: 'sat', sessions: [], rest: true },
    { key: 'sun', sessions: [t('plan.phase.exercises')], rest: false },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-2', colors.badge)}>
          <ClipboardList size={12} />
          {t('plan.badge')}
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">{t('plan.title', { module: t(`rehab.${type}`) })}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {t('plan.description')}
        </p>
      </motion.div>

      {/* Plan overview card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className={cn('p-6 rounded-2xl border', colors.light, colors.border)}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <h3 className={cn('font-bold text-lg mb-1', colors.textDark)}>{t('plan.overview.title')}</h3>
            <p className="text-sm text-slate-600 mb-3">{mod.description}</p>
            <div className="flex flex-wrap gap-2">
              {mod.conditions.map(c => (
                <span key={c} className={cn('px-2.5 py-1 rounded-full text-xs font-bold', colors.badge)}>{c}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 flex-shrink-0 text-center">
            {[
              { label: t('plan.overview.phases'),    value: '4'                       },
              { label: t('plan.overview.weeks'),     value: '16'                      },
              { label: t('plan.overview.exercises'), value: String(exercises.length) },
            ].map((item) => (
              <div key={item.label} className="bg-white/70 rounded-xl p-3">
                <p className={cn('text-2xl font-extrabold', colors.textDark)}>{item.value}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Phase timeline */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">{t('plan.phasesSection')}</h2>

        {phases.map((phase, idx) => {
          const isCompleted = phase.phase < CURRENT_PHASE;
          const isCurrent = phase.phase === CURRENT_PHASE;
          const isLocked = phase.phase > CURRENT_PHASE;

          return (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.08 }}
              className={cn(
                'bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all',
                isCurrent ? colors.border : isCompleted ? 'border-green-200' : 'border-slate-100'
              )}
            >
              {/* Phase header */}
              <div className={cn(
                'px-6 py-4 flex items-center gap-4',
                isCurrent ? colors.light : isCompleted ? 'bg-green-50' : 'bg-slate-50'
              )}>
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  isCompleted ? 'bg-green-500 text-white' :
                  isCurrent ? `${colors.primary} text-white` :
                  'bg-slate-200 text-slate-400'
                )}>
                  {isCompleted ? <CheckCircle2 size={18} /> :
                   isLocked ? <Lock size={16} /> :
                   <Target size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full',
                      isCompleted ? 'bg-green-100 text-green-700' :
                      isCurrent ? colors.badge :
                      'bg-slate-100 text-slate-400'
                    )}>
                      {t('phases.phaseShort', { n: phase.phase })}
                    </span>
                    {isCurrent && (
                      <span className={cn('text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full', colors.badge)}>
                        {t('phases.current')}
                      </span>
                    )}
                    {isCompleted && (
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        {t('phases.completed')}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 mt-0.5">
                    {t(`phaseContent.${type}.${phase.phase}.name`, { defaultValue: phase.name })}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t(`phaseContent.${type}.${phase.phase}.duration`, { defaultValue: phase.durationWeeks })}
                  </p>
                </div>
              </div>

              {/* Phase body */}
              <div className="px-6 py-5 grid md:grid-cols-3 gap-5">
                {/* Goal */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('plan.phase.goal')}</p>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {t(`phaseContent.${type}.${phase.phase}.goal`, { defaultValue: phase.goal })}
                  </p>
                </div>

                {/* Focus areas */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('plan.phase.focusAreas')}</p>
                  <ul className="space-y-1.5">
                    {phase.focusAreas.map((area) => (
                      <li key={area} className="flex items-start gap-2 text-xs text-slate-600">
                        <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1', isCompleted ? 'bg-green-400' : isCurrent ? colors.bar : 'bg-slate-300')} />
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Exercises */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('plan.phase.exercises')}</p>
                  <ul className="space-y-1.5">
                    {phase.exercises.map((exId) => (
                      <li key={exId} className="flex items-center gap-2">
                        {isCompleted ? (
                          <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                        ) : isCurrent ? (
                          <Dumbbell size={12} className={cn('flex-shrink-0', colors.text)} />
                        ) : (
                          <Circle size={12} className="text-slate-300 flex-shrink-0" />
                        )}
                        <span className="text-xs text-slate-600">{getExerciseTitle(exId)}</span>
                      </li>
                    ))}
                  </ul>
                  {!isLocked && (
                    <Link
                      to={`/rehab/${type}/exercises`}
                      className={cn('mt-3 flex items-center gap-1 text-xs font-bold transition-colors', isCurrent ? colors.text : 'text-green-600')}
                    >
                      {t('plan.phase.viewExercises')} <ChevronRight size={12} />
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Weekly schedule */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Calendar size={18} className="text-slate-400" />
          <h3 className="font-bold text-slate-900">{t('plan.schedule.title', { phase: CURRENT_PHASE })}</h3>
        </div>
        <div className="grid grid-cols-7 divide-x divide-slate-100">
          {WEEKLY_SCHEDULE.map((schedule) => (
            <div key={schedule.key} className={cn(
              'p-4 min-h-28',
              schedule.rest ? 'bg-slate-50/60' : ''
            )}>
              <p className="text-xs font-bold text-slate-400 mb-2">{t(`days.${schedule.key}`)}</p>
              {schedule.rest ? (
                <div className="flex flex-col items-center justify-center h-16">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-1">
                    <span className="text-lg">😴</span>
                  </div>
                  <p className="text-[10px] text-slate-300 text-center">{t('days.rest')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {schedule.sessions.map((s, i) => (
                    <p key={i} className={cn('text-[10px] leading-relaxed rounded-lg px-2 py-1', colors.light, colors.textDark)}>
                      {s}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ML Plan Personalisation Placeholder */}
      {/* TODO: Replace with ML-generated adaptive rehab plan recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
        className="p-6 bg-slate-900 rounded-2xl border border-slate-800"
      >
        <div className="flex items-center gap-3 mb-3">
          <Cpu size={18} className="text-slate-500" />
          <h3 className="font-bold text-white">{t('plan.aiPlaceholder.title')}</h3>
          <span className="ml-auto px-2 py-0.5 bg-slate-700 rounded-full text-[10px] font-bold text-slate-400 uppercase">
            {t('plan.aiPlaceholder.badge')}
          </span>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">
          {t('plan.aiPlaceholder.description')}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            t('plan.aiPlaceholder.features.1'),
            t('plan.aiPlaceholder.features.2'),
            t('plan.aiPlaceholder.features.3'),
            t('plan.aiPlaceholder.features.4'),
          ].map((feature) => (
            <div key={feature} className="flex items-start gap-2 p-3 bg-slate-800 rounded-xl">
              <Circle size={8} className="text-slate-600 mt-1 flex-shrink-0" />
              <p className="text-[11px] text-slate-400 leading-relaxed">{feature}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
