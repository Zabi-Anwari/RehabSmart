import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Send, Loader2, AlertCircle, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../components/AuthContext';
import { Card } from '../components/Cards';
import { subscribeConnection } from '../lib/connections';
import { markThreadRead, sendMessage, subscribeToThread } from '../lib/messages';
import { REHAB_MODULES } from '../constants';
import { cn } from '../lib/utils';
import type { Connection, Message } from '../types';

export function MessageThread() {
  const { connectionId: id } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to connection metadata + thread.
  useEffect(() => {
    if (!id) return;
    const unsubConn   = subscribeConnection(id, setConnection);
    const unsubThread = subscribeToThread(id, setMessages);
    return () => { unsubConn(); unsubThread(); };
  }, [id]);

  // Mark the thread as read whenever it's opened or new messages arrive while
  // the user is viewing it.
  useEffect(() => {
    if (!id || !profile) return;
    void markThreadRead(id, profile.role);
  }, [id, profile, messages.length]);

  // Auto-scroll to the bottom when new messages arrive.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  if (!id || !user || !profile) return null;

  // Access guard: this user must be one of the two parties.
  if (connection && connection.patientUid !== user.uid && connection.doctorUid !== user.uid) {
    return (
      <Card>
        <p className="text-sm text-red-600">{t('messages.thread.noAccess')}</p>
        <Link to="/messages" className="mt-3 inline-flex text-xs font-bold text-blue-600">{t('messages.thread.backLink')}</Link>
      </Card>
    );
  }

  if (!connection) {
    return <Card><p className="text-sm text-slate-500">{t('messages.thread.loading')}</p></Card>;
  }

  const viewerRole = profile.role;
  const counterpartyName  = viewerRole === 'doctor' ? connection.patientName     : connection.doctorName;
  const counterpartyPhoto = viewerRole === 'doctor' ? connection.patientPhotoUrl : connection.doctorPhotoUrl;
  const initials = counterpartyName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const canSend = connection.status === 'accepted';

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || sending) return;
    setErr(null);
    setSending(true);
    try {
      await sendMessage({
        connectionId: id,
        senderUid: user.uid,
        senderRole: viewerRole,
        text: draft,
      });
      setDraft('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('messages.thread.sendError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 pb-12 max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/messages')}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={14} /> {t('messages.thread.back')}
      </button>

      {/* Header */}
      <Card className="p-0">
        <div className="px-5 py-4 flex items-center gap-4 border-b border-slate-100">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 ring-blue-100">
            {counterpartyPhoto ? (
              <img src={counterpartyPhoto} alt={counterpartyName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-extrabold text-white">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900">
              {viewerRole === 'doctor' ? counterpartyName : t('findDoctor.drPrefix', { name: counterpartyName })}
            </p>
            {viewerRole === 'doctor' ? (
              <p className="text-xs text-slate-500">
                {connection.patientInjuryType
                  ? t('messages.rehabSuffix', { type: t(`injuries.${connection.patientInjuryType}`) })
                  : t('profile.accountTypePatient')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {connection.doctorSpecialties.map((s) => {
                  const mod = REHAB_MODULES[s];
                  return (
                    <span key={s} className={cn('text-[10px] px-1.5 py-0.5 rounded font-bold', mod.colors.light, mod.colors.text)}>
                      {t(`rehab.${s}`)}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          {viewerRole === 'doctor' && (
            <Link
              to={`/doctor/patient/${connection.patientUid}`}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 inline-flex items-center gap-1.5"
            >
              <Activity size={12} /> {t('messages.thread.viewProgress')}
            </Link>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="h-[55vh] overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/50">
          {connection.introMessage && messages.length === 0 && (
            <SystemNote text={t('messages.thread.introNote', { text: connection.introMessage })} />
          )}
          {messages.length === 0 && !connection.introMessage && (
            <div className="text-center py-12">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">{t('messages.thread.noMessagesTitle')}</p>
              <p className="text-xs text-slate-400 mt-1">{t('messages.thread.noMessagesDesc')}</p>
            </div>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} message={m} mine={m.senderUid === user.uid} />
          ))}
        </div>

        {/* Composer */}
        <form onSubmit={handleSend} className="px-5 py-4 border-t border-slate-100 flex items-end gap-2">
          {canSend ? (
            <>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                rows={1}
                maxLength={2000}
                placeholder={t('messages.thread.composerPlaceholder')}
                className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {t('messages.thread.send')}
              </button>
            </>
          ) : (
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
              <AlertCircle size={14} />
              {connection.status === 'pending'
                ? t('messages.thread.lockedPending')
                : t('messages.thread.lockedClosed')}
            </div>
          )}
        </form>
        {err && <p className="px-5 pb-3 text-xs text-red-600">{err}</p>}
      </Card>
    </div>
  );
}

const Bubble: React.FC<{ message: Message; mine: boolean }> = ({ message, mine }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn('flex', mine ? 'justify-end' : 'justify-start')}
    >
      <div className={cn(
        'max-w-[78%] px-4 py-2.5 rounded-2xl shadow-sm whitespace-pre-wrap break-words',
        mine
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm',
      )}>
        <p className="text-sm leading-relaxed">{message.text}</p>
        <p className={cn('text-[10px] mt-1', mine ? 'text-blue-100' : 'text-slate-400')}>
          {message.sentAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
};

function SystemNote({ text }: { text: string }) {
  return (
    <div className="text-center">
      <span className="inline-block px-3 py-1.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest">
        {text}
      </span>
    </div>
  );
}
