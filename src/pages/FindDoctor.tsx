import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Stethoscope, MapPin, Briefcase, Award, ChevronRight, Filter } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../components/AuthContext';
import { Card } from '../components/Cards';
import { subscribeToDoctors } from '../lib/doctorProfile';
import { subscribeConnectionsForPatient } from '../lib/connections';
import { REHAB_MODULES } from '../constants';
import { cn } from '../lib/utils';
import type { DoctorDirectoryEntry, RehabType, Connection } from '../types';

export function FindDoctor() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [doctors, setDoctors] = useState<DoctorDirectoryEntry[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [filter, setFilter] = useState<RehabType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const FILTERS: { label: string; value: RehabType | 'all' }[] = [
    { label: t('common.all'),         value: 'all'   },
    { label: t('rehab.kneeShort'),    value: 'knee'  },
    { label: t('rehab.legShort'),     value: 'leg'   },
    { label: t('rehab.elbowShort'),   value: 'elbow' },
  ];

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToDoctors((d) => {
      setDoctors(d);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeConnectionsForPatient(user.uid, setConnections);
    return () => unsub();
  }, [user]);

  const connByDoctor = useMemo(() => {
    const m = new Map<string, Connection>();
    for (const c of connections) m.set(c.doctorUid, c);
    return m;
  }, [connections]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return doctors.filter((d) => {
      if (filter !== 'all' && !d.specialties.includes(filter)) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.workArea.toLowerCase().includes(q) ||
        (d.clinicName ?? '').toLowerCase().includes(q)
      );
    });
  }, [doctors, filter, search]);

  if (profile?.role === 'doctor') {
    return (
      <Card>
        <p className="text-sm text-slate-600">{t('findDoctor.patientsOnly')}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-600 text-xs font-bold tracking-widest uppercase mb-2">
          <Stethoscope size={12} /> {t('findDoctor.badge')}
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">{t('findDoctor.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {t('findDoctor.description')}
        </p>
      </motion.div>

      {/* Search / filter bar */}
      <Card className="p-0">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('findDoctor.searchPlaceholder')}
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={14} className="text-slate-400 mr-1" />
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  filter === f.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Results */}
      {loading ? (
        <Card><p className="text-sm text-slate-500">{t('findDoctor.loading')}</p></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
              <Stethoscope size={28} />
            </div>
            <h4 className="font-bold text-slate-900">{t('findDoctor.noneTitle')}</h4>
            <p className="text-slate-500 text-sm mt-1">
              {search || filter !== 'all' ? t('findDoctor.noneFiltered') : t('findDoctor.noneEmpty')}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((d, i) => {
            const conn = connByDoctor.get(d.uid);
            return (
              <motion.div
                key={d.uid}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03 }}
              >
                <DoctorCard doctor={d} connection={conn} />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DoctorCard({ doctor, connection }: { doctor: DoctorDirectoryEntry; connection?: Connection }) {
  const { t } = useTranslation();
  const initials = doctor.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const statusBadge = connection && (
    <span className={cn(
      'px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-widest',
      connection.status === 'accepted' && 'bg-emerald-50 text-emerald-700',
      connection.status === 'pending'  && 'bg-amber-50 text-amber-700',
      connection.status === 'declined' && 'bg-slate-100 text-slate-500',
    )}>
      {connection.status === 'accepted' ? t('findDoctor.statusConnected') :
       connection.status === 'pending'  ? t('findDoctor.statusPending')    : t('findDoctor.statusDeclined')}
    </span>
  );

  return (
    <Card className="hover:shadow-md transition-shadow h-full">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 ring-2 ring-blue-100 overflow-hidden">
          {doctor.photoUrl ? (
            <img src={doctor.photoUrl} alt={doctor.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-extrabold text-white">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-slate-900 truncate">{t('findDoctor.drPrefix', { name: doctor.name })}</p>
            {statusBadge}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {doctor.specialties.map((s) => {
              const mod = REHAB_MODULES[s];
              return (
                <span key={s} className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold', mod.colors.light, mod.colors.text)}>
                  {t(`rehab.${s}`)}
                </span>
              );
            })}
          </div>
          <div className="mt-2 space-y-1 text-xs text-slate-500">
            {doctor.workArea && (
              <p className="inline-flex items-center gap-1.5"><MapPin size={12} /> {doctor.workArea}</p>
            )}
            {doctor.clinicName && (
              <p className="inline-flex items-center gap-1.5 ml-3"><Briefcase size={12} /> {doctor.clinicName}</p>
            )}
            <p className="inline-flex items-center gap-1.5"><Award size={12} /> {t('findDoctor.yearsExp', { years: doctor.yearsOfExperience })}</p>
          </div>
          {doctor.bio && (
            <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">{doctor.bio}</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Link
          to={`/doctor-profile/${doctor.uid}`}
          className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
        >
          {t('findDoctor.viewProfile')} <ChevronRight size={14} />
        </Link>
      </div>
    </Card>
  );
}
