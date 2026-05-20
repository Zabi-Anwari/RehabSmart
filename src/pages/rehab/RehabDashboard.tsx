import React from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity, Dumbbell, LineChart, ClipboardList, Cpu,
  TrendingUp, TrendingDown, CalendarCheck, Target,
  ChevronRight, AlertCircle, CheckCircle2, PlayCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { RehabType } from '../../types';
import { REHAB_MODULES, getExercisesByType, REHAB_PHASES } from '../../constants';
import { useAuth } from '../../components/AuthContext';
import { useSessions } from '../../hooks/useSessions';
import { useRehabMetrics } from '../../hooks/useRehabMetrics';
import { REHAB_TARGETS } from '../../lib/rehabConfig';

function isValidRehabType(t: string | undefined): t is RehabType {
  return t === 'knee' || t === 'leg' || t === 'elbow';
}

function StatCard({ label, value, sub, icon: Icon, colorClass }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; colorClass: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <div className={cn('p-2 rounded-xl', colorClass)}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1 font-medium">{sub}</p>}
    </div>
  );
}

function formatTrend(n: number, unit = '') {
  if (n === 0) return `±0${unit}`;
  return `${n > 0 ? '+' : ''}${n}${unit}`;
}

export function RehabDashboard() {
  const { type } = useParams<{ type: string }>();
  const { profile, user } = useAuth();
  const { t } = useTranslation();
  const { sessions, loading } = useSessions(user?.uid, isValidRehabType(type) ? type : 'knee');

  if (!isValidRehabType(type)) {
    return <Navigate to="/rehab/knee/dashboard" replace />;
  }

  const mod = REHAB_MODULES[type];
  const { colors } = mod;
  const exercises = getExercisesByType(type);
  const phases = REHAB_PHASES[type];
  const targets = REHAB_TARGETS[type];

  const metrics = useRehabMetrics(type, sessions);
  const currentPhase = phases.find(p => p.phase === metrics.currentPhase)!;
  const todayExercises = exercises.filter(e => e.phase <= metrics.currentPhase).slice(0, 3);
  const recentSessions = sessions.slice(0, 4);

  // Phase content (name, goal, duration) is translated via locale keys
  // keyed by rehab type + phase number. Phase 4 in en.json covers all 4.
  const phaseName     = t(`phaseContent.${type}.${metrics.currentPhase}.name`,     { defaultValue: currentPhase.name });
  const phaseGoal     = t(`phaseContent.${type}.${metrics.currentPhase}.goal`,     { defaultValue: currentPhase.goal });
  const phaseDuration = t(`phaseContent.${type}.${metrics.currentPhase}.duration`, { defaultValue: currentPhase.durationWeeks });

  // Build the chart series. Recharts handles `null` dataKey values as gaps;
  // we further drop leading nulls so a fresh user sees a chart that starts
  // at "today" instead of eight empty weeks.
  const chartData = metrics.weeklySeries;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-2', colors.badge)}>
            <Activity size={12} />
            {t(`rehab.${type}`)}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {t('dashboard.greeting', { name: profile?.name?.split(' ')[0] || t('profile.accountTypePatient') })}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {phaseName} · {phaseDuration}
          </p>
        </div>
        <Link
          to={`/rehab/${type}/exercises`}
          className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all', colors.primary, colors.primaryHover)}
        >
          <Dumbbell size={16} />
          {t('dashboard.startSession')}
        </Link>
      </motion.div>

      {/* ── Empty state for brand-new users ─────────────────────────────────── */}
      {metrics.isEmpty && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className={cn('p-6 rounded-2xl border-2 border-dashed flex flex-col sm:flex-row items-center gap-5', colors.light, colors.border)}
        >
          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0', 'bg-white', colors.text)}>
            <PlayCircle size={28} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-bold text-slate-900">{t('dashboard.noFirstSession.title')}</h3>
            <p className="text-sm text-slate-600 mt-1">
              {t('dashboard.noFirstSession.description')}
            </p>
          </div>
          <Link
            to={`/rehab/${type}/exercises`}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm whitespace-nowrap',
              colors.primary, colors.primaryHover,
            )}
          >
            <Dumbbell size={16} /> {t('dashboard.noFirstSession.cta')}
          </Link>
        </motion.div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: t('dashboard.stats.recovery'),
            value: `${metrics.recoveryPct}%`,
            sub: metrics.isEmpty
              ? t('dashboard.stats.recoveryTarget', { rom: targets.targetRom, sessions: targets.targetSessions })
              : t('dashboard.stats.recoveryTrend', { trend: formatTrend(metrics.recoveryTrend) }),
            icon: metrics.recoveryTrend >= 0 ? TrendingUp : TrendingDown,
            colorClass: `${colors.light} ${colors.text}`,
          },
          {
            label: t('dashboard.stats.sessionsDone'),
            value: metrics.sessionCount,
            sub: t('dashboard.stats.sessionsTarget', { sessions: targets.targetSessions }),
            icon: CalendarCheck,
            colorClass: 'bg-blue-50 text-blue-600',
          },
          {
            label: t('dashboard.stats.currentPhase'),
            value: t('phases.phaseShort', { n: metrics.currentPhase }),
            sub: phaseName,
            icon: Target,
            colorClass: 'bg-purple-50 text-purple-600',
          },
          {
            label: t('dashboard.stats.painLevel'),
            value: metrics.latestPainLevel !== null ? `${metrics.latestPainLevel}/10` : '--',
            sub: metrics.latestPainLevel === null
              ? t('dashboard.stats.painLogged')
              : metrics.latestPainLevel <= 3 ? t('dashboard.stats.painWellManaged') : t('dashboard.stats.painMonitor'),
            icon: metrics.latestPainLevel === null || metrics.latestPainLevel <= 3 ? CheckCircle2 : AlertCircle,
            colorClass: metrics.latestPainLevel === null
              ? 'bg-slate-100 text-slate-400'
              : metrics.latestPainLevel <= 3 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500',
          },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.07 }}>
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recovery Chart — takes 2 cols */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900">{t('dashboard.chart.title')}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.chart.subtitle')}</p>
            </div>
            <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold', colors.badge)}>
              {metrics.romTrend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {t('dashboard.chart.trend', { trend: formatTrend(metrics.romTrend) })}
            </div>
          </div>
          <div className="h-52">
            {metrics.isEmpty ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                <LineChart size={28} className="mb-2 opacity-40" />
                <p className="font-medium">{t('dashboard.chart.empty.title')}</p>
                <p className="text-xs mt-1">{t('dashboard.chart.empty.description')}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`grad-${type}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.chartHex} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={colors.chartHex} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, targets.targetRom]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    formatter={(v: number | null) => v === null ? ['--', 'No sessions'] : [`${v}°`, 'Range of Motion']}
                  />
                  <Area
                    type="monotone" dataKey="rom"
                    stroke={colors.chartHex} strokeWidth={2.5}
                    fill={`url(#grad-${type})`}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Current Phase Summary */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
        >
          <h3 className="font-bold text-slate-900 mb-1">{t('dashboard.stats.currentPhase')}</h3>
          <p className="text-xs text-slate-400 mb-4">{phaseDuration}</p>

          <div className={cn('p-4 rounded-xl mb-4', colors.light, colors.border, 'border')}>
            <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1', colors.text)}>
              {t('phases.phaseShort', { n: metrics.currentPhase })}
            </p>
            <p className="font-bold text-slate-900 text-sm">{phaseName}</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{phaseGoal}</p>
          </div>

          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('dashboard.phase.focusAreas')}</p>
          <div className="space-y-2">
            {currentPhase.focusAreas.map((area) => (
              <div key={area} className="flex items-center gap-2">
                <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', colors.bar)} />
                <span className="text-xs text-slate-600">{area}</span>
              </div>
            ))}
          </div>

          <Link
            to={`/rehab/${type}/plan`}
            className={cn('mt-4 flex items-center gap-2 text-xs font-bold transition-colors', colors.text)}
          >
            {t('dashboard.phase.viewPlan')} <ChevronRight size={14} />
          </Link>
        </motion.div>
      </div>

      {/* Today's Exercises + Recent Sessions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's exercises */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">{t('dashboard.todayExercises.title')}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.todayExercises.subtitle', { count: todayExercises.length })}</p>
            </div>
            <Link to={`/rehab/${type}/exercises`} className={cn('text-xs font-bold flex items-center gap-1', colors.text)}>
              {t('dashboard.todayExercises.viewAll')} <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {todayExercises.map((ex) => (
              <Link
                key={ex.id}
                to={`/rehab/${type}/exercises`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group"
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', colors.light)}>
                  <Dumbbell size={18} className={colors.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors truncate">
                    {t(`exerciseContent.${ex.id}.title`, { defaultValue: ex.title })}
                  </p>
                  <p className="text-xs text-slate-400">{ex.sets} {t('exercises.sets').toLowerCase()} × {ex.reps} {t('exercises.reps').toLowerCase()} · {ex.duration} {t('common.min')}</p>
                </div>
                <div className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', colors.badge)}>
                  {t(`difficulty.${ex.difficulty}`)}
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recent Sessions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">{t('dashboard.recentSessions.title')}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {metrics.sessionCount === 0
                  ? t('dashboard.recentSessions.noLog')
                  : t('dashboard.recentSessions.subtitle', { count: recentSessions.length, total: metrics.sessionCount })}
              </p>
            </div>
            <Link to={`/rehab/${type}/progress`} className={cn('text-xs font-bold flex items-center gap-1', colors.text)}>
              {t('dashboard.recentSessions.progressLink')} <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentSessions.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">
                {t('dashboard.recentSessions.empty')}
              </div>
            ) : recentSessions.map((session) => (
              <div key={session.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <CalendarCheck size={16} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">
                    {t(`exerciseContent.${session.exerciseId}.title`, { defaultValue: session.exerciseTitle })}
                  </p>
                  <p className="text-xs text-slate-400">
                    {session.date.toLocaleDateString()} · {Math.round(session.duration / 60)} {t('common.min')} · {session.romDegrees}° ROM
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{session.quality || '--'}%</p>
                  <p className="text-[10px] text-slate-400">{t('dashboard.recentSessions.quality')}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Quick Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: t('dashboard.quickNav.exercises'), desc: t('dashboard.quickNav.exercisesDesc'), icon: Dumbbell,      to: `/rehab/${type}/exercises` },
          { label: t('dashboard.quickNav.progress'),  desc: t('dashboard.quickNav.progressDesc'),  icon: LineChart,     to: `/rehab/${type}/progress`  },
          { label: t('dashboard.quickNav.plan'),      desc: t('dashboard.quickNav.planDesc'),      icon: ClipboardList, to: `/rehab/${type}/plan`      },
          { label: t('dashboard.quickNav.ml'),        desc: t('dashboard.quickNav.mlDesc'),        icon: Cpu,           to: `/rehab/${type}/ml`        },
        ].map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
          >
            <div className={cn('p-2.5 rounded-xl transition-colors', colors.light)}>
              <item.icon size={18} className={colors.text} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{item.label}</p>
              <p className="text-[11px] text-slate-400">{item.desc}</p>
            </div>
          </Link>
        ))}
      </motion.div>
    </div>
  );
}
