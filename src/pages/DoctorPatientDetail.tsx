import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, MessageCircle, Activity, CalendarDays, TrendingUp,
  AlertCircle, Clock, BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { motion } from 'motion/react';
import { Card } from '../components/Cards';
import { useAuth } from '../components/AuthContext';
import { useSessions } from '../hooks/useSessions';
import { connectionId, subscribeConnection } from '../lib/connections';
import { REHAB_MODULES } from '../constants';
import { cn } from '../lib/utils';
import type { Connection, RehabType } from '../types';

/**
 * Doctor's view of a single connected patient — recent sessions, ROM/quality/pain
 * trends across all three rehab modules, and quick links to message the patient.
 */
export function DoctorPatientDetail() {
  const { patientUid } = useParams<{ patientUid: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [activeModule, setActiveModule] = useState<RehabType>('knee');

  useEffect(() => {
    if (!user || !patientUid) return;
    const unsub = subscribeConnection(connectionId(patientUid, user.uid), setConnection);
    return () => unsub();
  }, [user, patientUid]);

  if (profile?.role !== 'doctor' || !patientUid) {
    return <Card><p className="text-sm text-slate-600">{t('doctor.patientDetail.doctorsOnly')}</p></Card>;
  }

  if (!connection) {
    return <Card><p className="text-sm text-slate-500">{t('doctor.patientDetail.loading')}</p></Card>;
  }
  if (connection.status !== 'accepted') {
    return (
      <Card>
        <div className="text-center py-10">
          <AlertCircle className="mx-auto text-amber-500 mb-3" size={32} />
          <h4 className="font-bold text-slate-900">{t('doctor.patientDetail.notConnected')}</h4>
          <p className="text-slate-500 text-sm mt-1">{t('doctor.patientDetail.notConnectedDesc')}</p>
          <button onClick={() => navigate('/doctor')} className="mt-4 text-sm font-bold text-blue-600">
            {t('doctor.patientDetail.backToDashboard')}
          </button>
        </div>
      </Card>
    );
  }

  const initials = connection.patientName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 pb-12">
      <button
        onClick={() => navigate('/doctor')}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={14} /> {t('doctor.patientDetail.back')}
      </button>

      {/* Patient header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 ring-2 ring-blue-100 overflow-hidden">
              {connection.patientPhotoUrl ? (
                <img src={connection.patientPhotoUrl} alt={connection.patientName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-extrabold text-white">{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold text-slate-900">{connection.patientName}</h1>
              <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {connection.patientInjuryType && (
                  <span className="inline-flex items-center gap-1.5">
                    <Activity size={12} /> {t('doctor.patientDetail.rehab', { type: t(`injuries.${connection.patientInjuryType}`) })}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={12} /> {t('doctor.patientDetail.connectedSince', { date: connection.respondedAt?.toLocaleDateString() ?? '—' })}
                </span>
              </div>
              {connection.introMessage && (
                <p className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 italic">
                  "{connection.introMessage}"
                </p>
              )}
            </div>
            <Link
              to={`/messages/${connection.id}`}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 flex items-center gap-2 shadow-md shadow-blue-200 self-start"
            >
              <MessageCircle size={14} /> {t('doctor.patientDetail.messageBtn')}
            </Link>
          </div>
        </Card>
      </motion.div>

      {/* Module switcher */}
      <div className="flex items-center gap-2">
        {(['knee', 'leg', 'elbow'] as RehabType[]).map((rt) => {
          const mod = REHAB_MODULES[rt];
          const active = activeModule === rt;
          return (
            <button
              key={rt}
              onClick={() => setActiveModule(rt)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all border',
                active
                  ? cn(mod.colors.light, mod.colors.text, mod.colors.border, 'shadow-sm')
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50',
              )}
            >
              {t(`rehab.${rt}`)}
            </button>
          );
        })}
      </div>

      {/* Per-module sections */}
      <PatientModuleSection patientUid={patientUid} rehabType={activeModule} />
    </div>
  );
}

function PatientModuleSection({ patientUid, rehabType }: { patientUid: string; rehabType: RehabType }) {
  const { t } = useTranslation();
  const { sessions, loading } = useSessions(patientUid, rehabType);
  const mod = REHAB_MODULES[rehabType];
  const moduleLabel = t(`rehab.${rehabType}`);

  // Build a small per-session series (newest at the end for the chart).
  const series = useMemo(() => {
    const recent = [...sessions].slice(0, 12).reverse();
    return recent.map((s, i) => ({
      idx: i + 1,
      date: s.date,
      rom: s.romDegrees,
      quality: s.quality,
      pain: s.painLevel,
    }));
  }, [sessions]);

  const totals = useMemo(() => {
    if (sessions.length === 0) return null;
    const avgQuality = Math.round(sessions.reduce((s, x) => s + x.quality, 0) / sessions.length);
    const avgPain    = (sessions.reduce((s, x) => s + x.painLevel, 0) / sessions.length).toFixed(1);
    const totalReps  = sessions.reduce((s, x) => s + x.repCount, 0);
    const totalMin   = Math.round(sessions.reduce((s, x) => s + x.duration, 0) / 60);
    const bestRom    = Math.max(...sessions.map((s) => s.romDegrees));
    return { avgQuality, avgPain, totalReps, totalMin, bestRom };
  }, [sessions]);

  if (loading) {
    return <Card><p className="text-sm text-slate-500">{t('doctor.patientDetail.loadingSessions', { module: moduleLabel })}</p></Card>;
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <div className="text-center py-10">
          <div className="w-16 h-16 mx-auto bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
            <BarChart2 size={28} />
          </div>
          <h4 className="font-bold text-slate-900">{t('doctor.patientDetail.noSessionsTitle', { module: moduleLabel })}</h4>
          <p className="text-slate-500 text-sm mt-1">
            {t('doctor.patientDetail.noSessionsDesc', { module: moduleLabel })}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label={t('doctor.patientDetail.stats.sessions')}    value={String(sessions.length)}              icon={CalendarDays} accent={mod.colors} />
        <Stat label={t('doctor.patientDetail.stats.totalReps')}   value={String(totals?.totalReps ?? 0)}        icon={Activity}     accent={mod.colors} />
        <Stat label={t('doctor.patientDetail.stats.activeMin')}   value={String(totals?.totalMin ?? 0)}         icon={Clock}        accent={mod.colors} />
        <Stat label={t('doctor.patientDetail.stats.avgQuality')}  value={`${totals?.avgQuality ?? 0}%`}        icon={TrendingUp}   accent={mod.colors} />
        <Stat label={t('doctor.patientDetail.stats.avgPain')}     value={`${totals?.avgPain ?? 0}/10`}          icon={AlertCircle}  accent={mod.colors} />
      </div>

      {/* Trend chart */}
      <Card title={t('doctor.patientDetail.trendTitle')} subtitle={t('doctor.patientDetail.trendSubtitle', { count: series.length })}>
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="romg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={mod.colors.chartHex} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={mod.colors.chartHex} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="idx" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                labelFormatter={(v) => `Session ${v}`}
                formatter={(value: number, name: string) => {
                  const unit = name === 'rom' ? '°' : name === 'pain' ? '/10' : '%';
                  return [`${value}${unit}`, name.toUpperCase()];
                }}
              />
              <Area type="monotone" dataKey="rom"     stroke={mod.colors.chartHex} fill="url(#romg)" strokeWidth={2} />
              <Area type="monotone" dataKey="quality" stroke="#10b981" fillOpacity={0} strokeWidth={1.5} strokeDasharray="4 4" />
              <Area type="monotone" dataKey="pain"    stroke="#ef4444" fillOpacity={0} strokeWidth={1.5} strokeDasharray="2 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
          <LegendDot color={mod.colors.chartHex} label={t('doctor.patientDetail.legendRom')} />
          <LegendDot color="#10b981" label={t('doctor.patientDetail.legendQuality')} />
          <LegendDot color="#ef4444" label={t('doctor.patientDetail.legendPain')} />
        </div>
      </Card>

      {/* Recent sessions table */}
      <Card title={t('doctor.patientDetail.recentTitle')} subtitle={t('doctor.patientDetail.recentSubtitle')}>
        <div className="overflow-x-auto -mx-6 -mb-6">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-y border-slate-100">
              <tr>
                {[
                  t('doctor.patientDetail.headers.date'),
                  t('doctor.patientDetail.headers.exercise'),
                  t('doctor.patientDetail.headers.repsSets'),
                  t('doctor.patientDetail.headers.quality'),
                  t('doctor.patientDetail.headers.pain'),
                  t('doctor.patientDetail.headers.rom'),
                  t('doctor.patientDetail.headers.duration'),
                ].map((h, i) => (
                  <th key={i} className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.slice(0, 20).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-3 text-xs text-slate-600">
                    {s.date.toLocaleDateString()} <span className="text-slate-400">{s.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-800 font-bold">{t(`exerciseContent.${s.exerciseId}.title`, { defaultValue: s.exerciseTitle })}</td>
                  <td className="px-6 py-3 text-xs text-slate-600">{s.repCount} × {s.setsCompleted}</td>
                  <td className="px-6 py-3 text-xs">
                    <span className={cn(
                      'font-bold',
                      s.quality >= 80 ? 'text-emerald-600' :
                      s.quality >= 60 ? 'text-amber-600'   : 'text-red-600',
                    )}>{s.quality}%</span>
                  </td>
                  <td className="px-6 py-3 text-xs">
                    <span className={cn(
                      'font-bold',
                      s.painLevel <= 3 ? 'text-emerald-600' :
                      s.painLevel <= 6 ? 'text-amber-600'   : 'text-red-600',
                    )}>{s.painLevel}/10</span>
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-600">{s.romDegrees}°</td>
                  <td className="px-6 py-3 text-xs text-slate-600">{Math.round(s.duration / 60)} {t('common.min')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent }: {
  label: string; value: string; icon: React.ComponentType<{ size?: number }>;
  accent: { light: string; text: string };
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <div className={cn('p-1.5 rounded-md', accent.light, accent.text)}>
          <Icon size={12} />
        </div>
      </div>
      <p className="text-lg font-extrabold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
