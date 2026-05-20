import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, MapPin, Briefcase, Award, GraduationCap, Languages,
  MessageCircle, Send, Loader2, AlertCircle, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Card } from '../components/Cards';
import { useAuth } from '../components/AuthContext';
import { subscribeToDoctor } from '../lib/doctorProfile';
import { connectionId, getConnection, requestConnection } from '../lib/connections';
import { REHAB_MODULES } from '../constants';
import { cn } from '../lib/utils';
import type { Connection, DoctorDirectoryEntry } from '../types';

export function DoctorPublicProfile() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [doctor, setDoctor] = useState<DoctorDirectoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [intro, setIntro] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToDoctor(uid, (d) => {
      setDoctor(d);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  // One-shot read of the existing connection (no need for live subscription
  // here — the public profile is a single moment-in-time view).
  useEffect(() => {
    if (!uid || !user) return;
    getConnection(connectionId(user.uid, uid)).then(setConnection).catch(() => setConnection(null));
  }, [uid, user]);

  const handleRequest = async () => {
    if (!user || !profile || !doctor || profile.role !== 'patient') return;
    setErr(null);
    setSubmitting(true);
    try {
      await requestConnection({
        patientUid: user.uid,
        doctorUid: doctor.uid,
        patientName: profile.name,
        patientPhotoUrl: profile.photoUrl,
        patientInjuryType: profile.injuryType,
        doctorName: doctor.name,
        doctorPhotoUrl: doctor.photoUrl,
        doctorSpecialties: doctor.specialties,
        introMessage: intro.trim() || undefined,
      });
      // Refresh the connection state so the UI flips to "pending".
      const fresh = await getConnection(connectionId(user.uid, doctor.uid));
      setConnection(fresh);
    } catch (e) {
      // Surface the underlying Firestore error in the console so a failure
      // here is debuggable from devtools — the user-facing message stays
      // friendly. Most "Could not send request" reports trace back to either
      // un-deployed firestore.rules or a stale rules version.
      console.error('requestConnection failed:', e);
      const code = e instanceof Error ? e.message : String(e);
      setErr(
        code === 'already-pending'        ? t('doctor.publicProfile.request.alreadyPending') :
        code === 'already-connected'      ? t('doctor.publicProfile.request.alreadyConnected') :
        code === 'previously-declined'    ? t('doctor.publicProfile.request.previouslyDeclined') :
        t('doctor.publicProfile.request.generic'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Card><p className="text-sm text-slate-500">{t('doctor.publicProfile.loading')}</p></Card>;
  }
  if (!doctor) {
    return (
      <Card>
        <div className="text-center py-10">
          <h4 className="font-bold text-slate-900">{t('doctor.publicProfile.notFound')}</h4>
          <p className="text-slate-500 text-sm mt-1">{t('doctor.publicProfile.notFoundDesc')}</p>
          <button onClick={() => navigate('/find-doctor')} className="mt-4 text-sm font-bold text-blue-600">
            {t('doctor.publicProfile.backToSearch')}
          </button>
        </div>
      </Card>
    );
  }

  const isPatient = profile?.role === 'patient';
  const initials = doctor.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 pb-12 max-w-3xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={14} /> {t('common.back')}
      </button>

      {/* Hero card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <div className="flex items-start gap-5 flex-wrap">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 ring-4 ring-blue-100 overflow-hidden">
              {doctor.photoUrl ? (
                <img src={doctor.photoUrl} alt={doctor.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-extrabold text-white">{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold text-slate-900">{t('findDoctor.drPrefix', { name: doctor.name })}</h1>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {doctor.specialties.map((s) => {
                  const mod = REHAB_MODULES[s];
                  return (
                    <span key={s} className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold', mod.colors.light, mod.colors.text)}>
                      {t('doctor.publicProfile.specialistTag', { module: t(`rehab.${s}`) })}
                    </span>
                  );
                })}
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-3 text-xs text-slate-500">
                {doctor.workArea && (
                  <p className="inline-flex items-center gap-1.5"><MapPin size={12} /> {doctor.workArea}</p>
                )}
                {doctor.clinicName && (
                  <p className="inline-flex items-center gap-1.5"><Briefcase size={12} /> {doctor.clinicName}</p>
                )}
                <p className="inline-flex items-center gap-1.5"><Award size={12} /> {t('doctor.publicProfile.yearsExp', { years: doctor.yearsOfExperience })}</p>
              </div>
            </div>
          </div>

          {/* Bio */}
          {doctor.bio && (
            <p className="text-sm text-slate-700 leading-relaxed mt-5 whitespace-pre-line">{doctor.bio}</p>
          )}
        </Card>
      </motion.div>

      {/* CV details */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title={t('doctor.publicProfile.education')} icon={<GraduationCap size={16} />}>
          {doctor.education.length === 0
            ? <p className="text-xs text-slate-400">{t('doctor.publicProfile.notListed')}</p>
            : <ul className="space-y-2 text-sm text-slate-700">{doctor.education.map((e, i) => <li key={i}>• {e}</li>)}</ul>}
        </Card>
        <Card title={t('doctor.publicProfile.certifications')} icon={<Award size={16} />}>
          {doctor.certifications.length === 0
            ? <p className="text-xs text-slate-400">{t('doctor.publicProfile.notListed')}</p>
            : <ul className="space-y-2 text-sm text-slate-700">{doctor.certifications.map((e, i) => <li key={i}>• {e}</li>)}</ul>}
        </Card>
        <Card title={t('doctor.publicProfile.languages')} icon={<Languages size={16} />} className="md:col-span-2">
          {doctor.languages.length === 0
            ? <p className="text-xs text-slate-400">{t('doctor.publicProfile.notListed')}</p>
            : <div className="flex flex-wrap gap-2">
                {doctor.languages.map((l) => (
                  <span key={l} className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">{l}</span>
                ))}
              </div>}
        </Card>
      </div>

      {/* Connection CTA — only for patients */}
      {isPatient && (
        <Card title={t('doctor.publicProfile.connection')}>
          {connection?.status === 'accepted' ? (
            <ConnectedPanel onMessage={() => navigate(`/messages/${connection.id}`)} />
          ) : connection?.status === 'pending' ? (
            <PendingPanel />
          ) : connection?.status === 'declined' ? (
            <DeclinedPanel />
          ) : (
            <RequestPanel
              intro={intro}
              setIntro={setIntro}
              onSubmit={handleRequest}
              submitting={submitting}
              error={err}
            />
          )}
        </Card>
      )}
    </div>
  );
}

function RequestPanel({ intro, setIntro, onSubmit, submitting, error }: {
  intro: string; setIntro: (v: string) => void;
  onSubmit: () => void; submitting: boolean; error: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {t('doctor.publicProfile.request.info')}
      </p>
      <textarea
        value={intro}
        onChange={(e) => setIntro(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder={t('doctor.publicProfile.request.placeholder')}
        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      {error && (
        <p className="text-xs text-red-600 inline-flex items-center gap-1"><AlertCircle size={12} /> {error}</p>
      )}
      <div className="flex justify-end">
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-200 flex items-center gap-2"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {t('doctor.publicProfile.request.send')}
        </button>
      </div>
    </div>
  );
}

function PendingPanel() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
      <Clock className="text-amber-600 flex-shrink-0" size={18} />
      <div>
        <p className="text-sm font-bold text-amber-800">{t('doctor.publicProfile.pending.title')}</p>
        <p className="text-xs text-amber-700">{t('doctor.publicProfile.pending.desc')}</p>
      </div>
    </div>
  );
}

function ConnectedPanel({ onMessage }: { onMessage: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="text-emerald-600 flex-shrink-0" size={18} />
        <p className="text-sm font-bold text-emerald-800">{t('doctor.publicProfile.connected.desc')}</p>
      </div>
      <button
        onClick={onMessage}
        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5"
      >
        <MessageCircle size={12} /> {t('doctor.publicProfile.connected.btn')}
      </button>
    </div>
  );
}

function DeclinedPanel() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
      <XCircle className="text-slate-500 flex-shrink-0" size={18} />
      <div>
        <p className="text-sm font-bold text-slate-700">{t('doctor.publicProfile.declined.title')}</p>
        <p className="text-xs text-slate-500">{t('doctor.publicProfile.declined.desc')}</p>
      </div>
    </div>
  );
}
