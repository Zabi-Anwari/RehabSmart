import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Search, Stethoscope, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Card } from '../components/Cards';
import { useAuth } from '../components/AuthContext';
import {
  subscribeConnectionsForDoctor,
  subscribeConnectionsForPatient,
} from '../lib/connections';
import { REHAB_MODULES } from '../constants';
import { cn } from '../lib/utils';
import type { Connection } from '../types';

/**
 * Conversation list — shows every accepted connection for the current user,
 * ordered by most recent activity. Both patients and doctors land here.
 */
export function Messages() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) return;
    const sub = profile.role === 'doctor'
      ? subscribeConnectionsForDoctor(user.uid, (c) => { setConnections(c); setLoading(false); })
      : subscribeConnectionsForPatient(user.uid, (c) => { setConnections(c); setLoading(false); });
    return () => sub();
  }, [user, profile]);

  const accepted = useMemo(
    () => connections.filter((c) => c.status === 'accepted'),
    [connections],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accepted;
    return accepted.filter((c) => {
      const counterparty = profile?.role === 'doctor' ? c.patientName : c.doctorName;
      return counterparty.toLowerCase().includes(q);
    });
  }, [accepted, search, profile]);

  return (
    <div className="space-y-6 pb-12">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-600 text-xs font-bold tracking-widest uppercase mb-2">
          <MessageCircle size={12} /> {t('messages.badge')}
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          {profile?.role === 'doctor' ? t('messages.titleDoctor') : t('messages.titlePatient')}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {profile?.role === 'doctor' ? t('messages.subtitleDoctor') : t('messages.subtitlePatient')}
        </p>
      </motion.div>

      {/* Search */}
      <Card className="p-0">
        <div className="px-6 py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={profile?.role === 'doctor' ? t('messages.searchPatients') : t('messages.searchDoctors')}
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <Card><p className="text-sm text-slate-500">{t('messages.loading')}</p></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
              <MessageCircle size={28} />
            </div>
            <h4 className="font-bold text-slate-900">{t('messages.emptyTitle')}</h4>
            <p className="text-slate-500 text-sm mt-1">
              {profile?.role === 'doctor' ? t('messages.emptyDoctor') : t('messages.emptyPatient')}
            </p>
            {profile?.role !== 'doctor' && (
              <Link to="/find-doctor" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700">
                <Stethoscope size={14} /> {t('messages.findDoctor')}
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
            >
              <ConversationRow connection={c} viewerRole={profile?.role ?? 'patient'} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationRow({
  connection: c, viewerRole,
}: { connection: Connection; viewerRole: 'patient' | 'doctor' }) {
  const { t } = useTranslation();
  const counterpartyName  = viewerRole === 'doctor' ? c.patientName     : c.doctorName;
  const counterpartyPhoto = viewerRole === 'doctor' ? c.patientPhotoUrl : c.doctorPhotoUrl;
  const unread            = viewerRole === 'doctor' ? c.doctorUnread    : c.patientUnread;
  const lastMine          = c.lastMessageBy === viewerRole;
  const initials = (counterpartyName || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Link to={`/messages/${c.id}`} className="block">
      <div className={cn(
        'bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all px-5 py-4 flex items-center gap-4',
        unread > 0 ? 'border-blue-300' : 'border-slate-200',
      )}>
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 ring-blue-100">
          {counterpartyPhoto ? (
            <img src={counterpartyPhoto} alt={counterpartyName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-extrabold text-white">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-slate-900 truncate">
              {viewerRole === 'doctor' ? counterpartyName : t('findDoctor.drPrefix', { name: counterpartyName })}
            </p>
            {c.lastMessageAt && (
              <p className="text-[10px] text-slate-400 flex-shrink-0">
                {formatTime(c.lastMessageAt, t('messages.yesterday'))}
              </p>
            )}
          </div>
          {viewerRole === 'doctor' && c.patientInjuryType && (
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              {t('messages.rehabSuffix', { type: t(`injuries.${c.patientInjuryType}`) })}
            </p>
          )}
          {viewerRole === 'patient' && c.doctorSpecialties.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-0.5">
              {c.doctorSpecialties.map((s) => {
                const mod = REHAB_MODULES[s];
                return (
                  <span key={s} className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold', mod.colors.light, mod.colors.text)}>
                    {t(`rehab.${s}`)}
                  </span>
                );
              })}
            </div>
          )}
          <p className={cn(
            'text-xs mt-1 truncate',
            unread > 0 && !lastMine ? 'text-slate-900 font-bold' : 'text-slate-500',
          )}>
            {c.lastMessageText
              ? (lastMine ? t('messages.youPrefix') : '') + c.lastMessageText
              : <span className="italic text-slate-400">{t('messages.noPreview')}</span>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {unread > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold min-w-[20px] text-center">
              {unread}
            </span>
          )}
          <ChevronRight size={14} className="text-slate-300" />
        </div>
      </div>
    </Link>
  );
}

function formatTime(d: Date, yesterdayLabel: string): string {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return yesterdayLabel;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
