import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, StatCard } from '../components/Cards';
import {
  Users, Search, MoreHorizontal, ShieldAlert, Stethoscope,
  Activity, MessageCircle, TrendingUp, Inbox, CheckCircle2, XCircle,
  Settings, Clock, AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/AuthContext';
import {
  subscribeConnectionsForDoctor,
  acceptConnection,
  declineConnection,
} from '../lib/connections';
import { REHAB_MODULES } from '../constants';
import { cn } from '../lib/utils';
import type { Connection, RehabType } from '../types';

export function DoctorDashboard() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<RehabType | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeConnectionsForDoctor(user.uid, (c) => {
      setConnections(c);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const pending  = useMemo(() => connections.filter((c) => c.status === 'pending'),  [connections]);
  const accepted = useMemo(() => connections.filter((c) => c.status === 'accepted'), [connections]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accepted.filter((c) => {
      const matchSearch = !q ||
        c.patientName.toLowerCase().includes(q) ||
        (c.patientInjuryType ?? '').toLowerCase().includes(q);
      const matchFilter = !filterType || c.doctorSpecialties.includes(filterType);
      return matchSearch && matchFilter;
    });
  }, [accepted, searchQuery, filterType]);

  // Profile-complete reminder banner.
  const profileComplete = (profile as unknown as { doctorProfile?: { profileComplete?: boolean } })?.doctorProfile?.profileComplete;

  return (
    <div className="space-y-8 pb-12">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-600 text-xs font-bold tracking-widest uppercase mb-2">
            <Stethoscope size={12} /> {t('doctor.portal')}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {t('doctor.greeting', { name: profile?.name?.split(' ')[0] || t('profile.accountTypeDoctor') })}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {t('doctor.subtitle')}
          </p>
        </div>
        <Link
          to="/doctor/settings"
          className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 self-start"
        >
          <Settings size={16} /> {t('doctor.profileBtn')}
        </Link>
      </motion.div>

      {/* Profile-completion banner */}
      {!profileComplete && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">{t('doctor.profileIncomplete.title')}</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {t('doctor.profileIncomplete.desc')}
              </p>
            </div>
            <Link
              to="/doctor/settings"
              className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 flex-shrink-0"
            >
              {t('doctor.profileIncomplete.cta')}
            </Link>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label={t('doctor.stats.connected')} value={accepted.length}                          icon={Users}        color="blue"   />
        <StatCard label={t('doctor.stats.pending')}   value={pending.length}                           icon={Inbox}        color="purple" />
        <StatCard label={t('doctor.stats.active')}    value={accepted.filter((c) => c.lastMessageAt).length} icon={MessageCircle} color="green"  />
        <StatCard label={t('doctor.stats.unread')}    value={accepted.reduce((s, c) => s + c.doctorUnread, 0)} icon={ShieldAlert} color="red"    />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-8">

        {/* Patient directory — 2 cols */}
        <div className="lg:col-span-2 space-y-6">

          {/* Pending requests section — only when there are any */}
          {pending.length > 0 && (
            <Card title={t('doctor.requests.title', { count: pending.length })} icon={<Inbox className="text-purple-500" size={18} />}>
              <AnimatePresence>
                <div className="space-y-3">
                  {pending.map((c) => (
                    <PendingRequestRow key={c.id} connection={c} />
                  ))}
                </div>
              </AnimatePresence>
            </Card>
          )}

          {/* Connected patients */}
          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-bold text-slate-900">{t('doctor.patients.title')}</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('doctor.patients.searchPlaceholder')}
                    className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-56"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  {[null, 'knee', 'leg', 'elbow'].map((opt) => (
                    <button
                      key={String(opt)}
                      onClick={() => setFilterType(opt as RehabType | null)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                        filterType === opt
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                      )}
                    >
                      {opt === null ? t('common.all') : t(`rehab.${opt}Short`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">{t('common.loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                  <Users size={32} />
                </div>
                <h4 className="font-bold text-slate-900">{t('doctor.patients.noneTitle')}</h4>
                <p className="text-slate-500 text-sm mt-1 max-w-xs">
                  {accepted.length === 0 ? t('doctor.patients.empty') : t('doctor.patients.emptyFiltered')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {[
                        t('doctor.patients.headers.patient'),
                        t('doctor.patients.headers.focus'),
                        t('doctor.patients.headers.connected'),
                        t('doctor.patients.headers.lastActivity'),
                        t('doctor.patients.headers.unread'),
                        '',
                      ].map((h, i) => (
                        <th key={i} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((c, i) => {
                      const initials = c.patientName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
                      const lastActivity = c.lastMessageAt ?? c.respondedAt ?? c.requestedAt;
                      return (
                        <motion.tr
                          key={c.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                          className="hover:bg-slate-50/80 transition-all group"
                        >
                          <td className="px-6 py-4">
                            <Link to={`/doctor/patient/${c.patientUid}`} className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm overflow-hidden text-white">
                                {c.patientPhotoUrl
                                  ? <img src={c.patientPhotoUrl} alt={c.patientName} className="w-full h-full object-cover" />
                                  : <span>{initials}</span>}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm">
                                  {c.patientName}
                                </p>
                                {c.patientInjuryType && (
                                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{c.patientInjuryType}</p>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            {c.patientInjuryType ? injuryToRehabBadge(c.patientInjuryType) : <span className="text-xs text-slate-400">—</span>}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            {c.respondedAt?.toLocaleDateString() ?? '—'}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            {lastActivity.toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            {c.doctorUnread > 0 ? (
                              <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                                {t('doctor.patients.newBadge', { count: c.doctorUnread })}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Link
                                to={`/messages/${c.id}`}
                                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                title={t('doctor.patients.openChat')}
                              >
                                <MessageCircle size={16} />
                              </Link>
                              <Link
                                to={`/doctor/patient/${c.patientUid}`}
                                className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                title={t('doctor.patients.viewProgress')}
                              >
                                <Activity size={16} />
                              </Link>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card title={t('doctor.caseload')}>
            <div className="space-y-3">
              {(['knee', 'leg', 'elbow'] as const).map((type) => {
                const count = accepted.filter((c) => injuryTypeToRehab(c.patientInjuryType) === type).length;
                const mod   = REHAB_MODULES[type];
                const pct   = accepted.length ? (count / accepted.length) * 100 : 0;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold', mod.colors.light, mod.colors.text)}>
                      {count}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">{t(`rehab.${type}`)}</p>
                    </div>
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', mod.colors.bar)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title={t('doctor.insights.title')}>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl flex-shrink-0">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{t('doctor.insights.trendLabel')}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {accepted.length === 0
                      ? t('doctor.insights.empty')
                      : accepted.length === 1
                        ? t('doctor.insights.followingOne', { count: 1 })
                        : t('doctor.insights.followingMany', { count: accepted.length })}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

const PendingRequestRow: React.FC<{ connection: Connection }> = ({ connection }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const initials = connection.patientName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const onAccept = async () => {
    setBusy('accept');
    try { await acceptConnection(connection.id); } finally { setBusy(null); }
  };
  const onDecline = async () => {
    setBusy('decline');
    try { await declineConnection(connection.id); } finally { setBusy(null); }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -8 }}
      className="p-4 border border-purple-100 bg-purple-50/30 rounded-xl flex items-start gap-4 flex-wrap"
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0 ring-2 ring-purple-100 overflow-hidden text-white">
        {connection.patientPhotoUrl
          ? <img src={connection.patientPhotoUrl} alt={connection.patientName} className="w-full h-full object-cover" />
          : <span className="text-sm font-extrabold">{initials}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900">{connection.patientName}</p>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-0.5 inline-flex items-center gap-1">
          <Clock size={10} /> {t('doctor.requests.requested', { date: connection.requestedAt.toLocaleDateString() })}
          {connection.patientInjuryType && <> · {t('messages.rehabSuffix', { type: connection.patientInjuryType })}</>}
        </p>
        {connection.introMessage && (
          <p className="mt-2 text-xs text-slate-700 italic">"{connection.introMessage}"</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onDecline}
          disabled={!!busy}
          className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
        >
          <XCircle size={12} /> {t('doctor.requests.decline')}
        </button>
        <button
          onClick={onAccept}
          disabled={!!busy}
          className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
        >
          <CheckCircle2 size={12} /> {t('doctor.requests.accept')}
        </button>
      </div>
    </motion.div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function injuryTypeToRehab(injuryType: string | undefined): RehabType | null {
  if (!injuryType) return null;
  const v = injuryType.toLowerCase();
  if (v === 'knee') return 'knee';
  if (v === 'leg' || v === 'walking') return 'leg';
  if (v === 'elbow' || v === 'wrist' || v === 'hand') return 'elbow';
  return null;
}

function injuryToRehabBadge(injuryType: string) {
  const type = injuryTypeToRehab(injuryType);
  if (!type) return <span className="text-xs text-slate-400">—</span>;
  const mod = REHAB_MODULES[type];
  return (
    <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest', mod.colors.badge)}>
      {mod.label}
    </span>
  );
}
