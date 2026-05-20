import React, { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, Activity, BarChart2,
  CalendarDays, Clock, AlertCircle, CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { RehabType } from '../../types';
import { REHAB_MODULES } from '../../constants';
import { useAuth } from '../../components/AuthContext';
import { useSessions } from '../../hooks/useSessions';
import { useRehabMetrics } from '../../hooks/useRehabMetrics';
import { REHAB_TARGETS } from '../../lib/rehabConfig';

function isValidRehabType(t: string | undefined): t is RehabType {
  return t === 'knee' || t === 'leg' || t === 'elbow';
}

type ChartTab = 'rom' | 'quality' | 'pain';

export function RehabProgress() {
  const { type } = useParams<{ type: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ChartTab>('rom');

  const TAB_META: Record<ChartTab, { label: string; unit: string; tooltipLabel: string }> = {
    rom:     { label: t('progress.chart.tabs.rom'),     unit: '°',   tooltipLabel: t('progress.stats.romGained')    },
    quality: { label: t('progress.chart.tabs.quality'), unit: '%',   tooltipLabel: t('progress.stats.quality')      },
    pain:    { label: t('progress.chart.tabs.pain'),    unit: '/10', tooltipLabel: t('progress.stats.pain')         },
  };

  if (!isValidRehabType(type)) {
    return <Navigate to="/rehab/knee/progress" replace />;
  }

  const { sessions, loading } = useSessions(user?.uid, type);
  const metrics = useRehabMetrics(type, sessions);
  const mod = REHAB_MODULES[type];
  const { colors } = mod;
  const targets = REHAB_TARGETS[type];

  const firstWithRom = metrics.weeklySeries.find(w => w.rom !== null);
  const latestWithRom = [...metrics.weeklySeries].reverse().find(w => w.rom !== null);
  const romGain = (latestWithRom?.rom ?? 0) - (firstWithRom?.rom ?? 0);

  const firstWithQuality = metrics.weeklySeries.find(w => w.quality !== null);
  const latestWithQuality = [...metrics.weeklySeries].reverse().find(w => w.quality !== null);
  const qualityGain = (latestWithQuality?.quality ?? 0) - (firstWithQuality?.quality ?? 0);

  const firstWithPain = metrics.weeklySeries.find(w => w.pain !== null);
  const latestWithPain = [...metrics.weeklySeries].reverse().find(w => w.pain !== null);
  const painChange = (latestWithPain?.pain ?? 0) - (firstWithPain?.pain ?? 0);

  const tabMeta = TAB_META[activeTab];
  const yDomain: [number, number] | undefined =
    activeTab === 'rom'     ? [0, targets.targetRom] :
    activeTab === 'quality' ? [0, 100] :
    activeTab === 'pain'    ? [0, 10]  : undefined;

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-2', colors.badge)}>
          <BarChart2 size={12} />
          {t('progress.badge')}
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">{t('progress.title', { module: t(`rehab.${type}`) })}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {t('progress.description')}
        </p>
      </motion.div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('progress.stats.romGained'),     value: metrics.isEmpty ? '--' : `${romGain >= 0 ? '+' : ''}${romGain}°`, sub: t('progress.stats.romGainedSub'), icon: TrendingUp, positive: true },
          { label: t('progress.stats.quality'),       value: latestWithQuality?.quality !== undefined && latestWithQuality.quality !== null ? `${latestWithQuality.quality}%` : '--', sub: metrics.isEmpty ? t('progress.stats.qualityNoData') : t('progress.stats.qualityOverall', { gain: `${qualityGain >= 0 ? '+' : ''}${qualityGain}` }), icon: Activity, positive: qualityGain >= 0 },
          { label: t('progress.stats.pain'),          value: metrics.latestPainLevel !== null ? `${metrics.latestPainLevel}/10` : '--', sub: metrics.isEmpty ? t('progress.stats.painLogged') : painChange <= 0 ? t('progress.stats.painDecrease', { change: Math.abs(painChange) }) : t('progress.stats.painMonitor'), icon: painChange <= 0 ? CheckCircle2 : AlertCircle, positive: painChange <= 0 },
          { label: t('progress.stats.sessions'),      value: metrics.sessionCount, sub: t('progress.stats.sessionsTarget', { target: targets.targetSessions }), icon: CalendarDays, positive: true },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.07 }}>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <div className={cn('p-2 rounded-xl', stat.positive ? `${colors.light} ${colors.text}` : 'bg-red-50 text-red-500')}>
                  <stat.icon size={16} />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Chart with Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-slate-900">{t('progress.chart.title')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t('progress.chart.subtitle')}</p>
          </div>
          <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
            {(['rom', 'quality', 'pain'] as ChartTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
                  activeTab === tab ? `${colors.primary} text-white shadow-sm` : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {TAB_META[tab].label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64">
          {metrics.isEmpty ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
              <BarChart2 size={28} className="mb-2 opacity-40" />
              <p className="font-medium">{t('progress.chart.empty.title')}</p>
              <p className="text-xs mt-1">{t('progress.chart.empty.description')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.weeklySeries}>
                <defs>
                  <linearGradient id={`pg-${type}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.chartHex} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={colors.chartHex} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} domain={yDomain} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  formatter={(v: number | null) => v === null ? ['--', t('dashboard.recentSessions.noLog')] : [`${v}${tabMeta.unit}`, tabMeta.tooltipLabel]}
                />
                <Area
                  type="monotone" dataKey={activeTab}
                  stroke={colors.chartHex} strokeWidth={2.5}
                  fill={`url(#pg-${type})`}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {/* Session History */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">{t('progress.history.title')}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {loading ? t('common.loading') : t('progress.history.subtitle', { count: sessions.length })}
          </p>
        </div>
        <div className="overflow-x-auto">
          {sessions.length === 0 && !loading ? (
            <div className="px-6 py-10 text-center text-sm text-slate-400">
              {t('progress.history.empty')}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {[
                    t('progress.history.headers.date'),
                    t('progress.history.headers.exercise'),
                    t('progress.history.headers.quality'),
                    t('progress.history.headers.pain'),
                    t('progress.history.headers.rom'),
                    t('progress.history.headers.duration'),
                  ].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-600 text-xs font-medium">{session.date.toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-slate-900 font-semibold">{t(`exerciseContent.${session.exerciseId}.title`, { defaultValue: session.exerciseTitle })}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', colors.bar)} style={{ width: `${session.quality}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-700">{session.quality || '--'}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-bold',
                        session.painLevel <= 3 ? 'bg-green-100 text-green-700' :
                        session.painLevel <= 6 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                      )}>
                        {session.painLevel}/10
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 text-xs font-bold">{session.romDegrees}°</td>
                    <td className="px-6 py-4 text-slate-600 text-xs">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {Math.round(session.duration / 60)} {t('common.min')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
}
