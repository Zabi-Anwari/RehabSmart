import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Stethoscope, MapPin, GraduationCap, Award, Languages, Save,
  Plus, X, AlertCircle, CheckCircle2, Loader2, ArrowLeft, IdCard,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Card } from '../components/Cards';
import { useAuth } from '../components/AuthContext';
import {
  hydrateDoctorProfile, isProfileComplete, saveDoctorProfile,
  type DoctorProfileInput,
} from '../lib/doctorProfile';
import type { RehabType } from '../types';
import { cn } from '../lib/utils';

const EMPTY: DoctorProfileInput = {
  specialties: [],
  workArea: '',
  clinicName: '',
  bio: '',
  yearsOfExperience: 0,
  education: [],
  certifications: [],
  languages: [],
  licenseNumber: '',
};

export function DoctorSettings() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const SPECIALTY_OPTIONS: { type: RehabType; label: string; description: string }[] = [
    { type: 'knee',  label: t('doctor.settings.specialties.kneeLabel'),  description: t('doctor.settings.specialties.kneeDesc')  },
    { type: 'leg',   label: t('doctor.settings.specialties.legLabel'),   description: t('doctor.settings.specialties.legDesc')   },
    { type: 'elbow', label: t('doctor.settings.specialties.elbowLabel'), description: t('doctor.settings.specialties.elbowDesc') },
  ];

  const initial = useMemo(() => {
    const hydrated = hydrateDoctorProfile((profile as unknown as { doctorProfile?: Record<string, unknown> })?.doctorProfile);
    if (!hydrated) return EMPTY;
    return {
      specialties: hydrated.specialties,
      workArea: hydrated.workArea,
      clinicName: hydrated.clinicName ?? '',
      bio: hydrated.bio,
      yearsOfExperience: hydrated.yearsOfExperience,
      education: hydrated.education,
      certifications: hydrated.certifications,
      languages: hydrated.languages,
      licenseNumber: hydrated.licenseNumber ?? '',
    } as DoctorProfileInput;
  }, [profile]);

  const [form, setForm] = useState<DoctorProfileInput>(initial);
  const [saving, setSaving]   = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError]     = useState<string | null>(null);

  // Re-sync when profile finishes loading after a fresh login.
  useEffect(() => { setForm(initial); }, [initial]);

  if (!user || !profile) return null;
  if (profile.role !== 'doctor') {
    navigate('/');
    return null;
  }

  const complete = isProfileComplete(form);

  const toggleSpecialty = (type: RehabType) => {
    setForm((f) => ({
      ...f,
      specialties: f.specialties.includes(type)
        ? f.specialties.filter((s) => s !== type)
        : [...f.specialties, type],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await saveDoctorProfile(user.uid, profile.name, profile.photoUrl, {
        ...form,
        // Drop empty strings from CV list fields so we don't write blank rows.
        education:      form.education.map((s) => s.trim()).filter(Boolean),
        certifications: form.certifications.map((s) => s.trim()).filter(Boolean),
        languages:      form.languages.map((s) => s.trim()).filter(Boolean),
      });
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => navigate('/doctor')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-4"
        >
          <ArrowLeft size={14} /> {t('doctor.settings.back')}
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-600 text-xs font-bold tracking-widest uppercase mb-2">
              <Stethoscope size={12} /> {t('doctor.settings.badge')}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">{t('doctor.settings.title')}</h1>
            <p className="text-slate-500 text-sm mt-1">
              {t('doctor.settings.subtitle')}
            </p>
          </div>
          <div className={cn(
            'px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border',
            complete ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200',
          )}>
            {complete ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {complete ? t('doctor.settings.visible') : t('doctor.settings.hidden')}
          </div>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Specialties */}
        <Card title={t('doctor.settings.specialties.title')} subtitle={t('doctor.settings.specialties.subtitle')}>
          <div className="grid sm:grid-cols-3 gap-3">
            {SPECIALTY_OPTIONS.map((opt) => {
              const active = form.specialties.includes(opt.type);
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => toggleSpecialty(opt.type)}
                  className={cn(
                    'text-left p-4 rounded-xl border-2 transition-all',
                    active
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                >
                  <p className={cn('font-bold text-sm', active ? 'text-blue-700' : 'text-slate-800')}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Work area / clinic / years */}
        <Card title={t('doctor.settings.practice.title')}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t('doctor.settings.practice.workArea')} icon={<MapPin size={14} />}>
              <input
                value={form.workArea}
                onChange={(e) => setForm((f) => ({ ...f, workArea: e.target.value }))}
                placeholder={t('doctor.settings.practice.workAreaPlaceholder')}
                className="input"
              />
            </Field>
            <Field label={t('doctor.settings.practice.clinic')}>
              <input
                value={form.clinicName ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, clinicName: e.target.value }))}
                placeholder={t('doctor.settings.practice.clinicPlaceholder')}
                className="input"
              />
            </Field>
            <Field label={t('doctor.settings.practice.years')}>
              <input
                type="number" min={0} max={70}
                value={form.yearsOfExperience}
                onChange={(e) => setForm((f) => ({ ...f, yearsOfExperience: Math.max(0, Number(e.target.value) || 0) }))}
                className="input"
              />
            </Field>
            <Field label={t('doctor.settings.practice.license')} icon={<IdCard size={14} />}>
              <input
                value={form.licenseNumber ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, licenseNumber: e.target.value }))}
                placeholder={t('doctor.settings.practice.licensePlaceholder')}
                className="input"
              />
            </Field>
          </div>
          <Field label={t('doctor.settings.practice.bio')} hint={t('doctor.settings.practice.bioHint')}>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={4}
              placeholder={t('doctor.settings.practice.bioPlaceholder')}
              className="input resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">{t('doctor.settings.practice.bioCounter', { count: form.bio.trim().length })}</p>
          </Field>
        </Card>

        {/* CV: lists */}
        <Card title={t('doctor.settings.cv.title')} subtitle={t('doctor.settings.cv.subtitle')}>
          <div className="space-y-6">
            <ListEditor
              label={t('doctor.settings.cv.education')}
              icon={<GraduationCap size={14} />}
              placeholder={t('doctor.settings.cv.educationPlaceholder')}
              addLabel={t('doctor.settings.cv.add', { name: t('doctor.settings.cv.education').toLowerCase() })}
              items={form.education}
              onChange={(education) => setForm((f) => ({ ...f, education }))}
            />
            <ListEditor
              label={t('doctor.settings.cv.certifications')}
              icon={<Award size={14} />}
              placeholder={t('doctor.settings.cv.certificationsPlaceholder')}
              addLabel={t('doctor.settings.cv.add', { name: t('doctor.settings.cv.certifications').toLowerCase() })}
              items={form.certifications}
              onChange={(certifications) => setForm((f) => ({ ...f, certifications }))}
            />
            <ListEditor
              label={t('doctor.settings.cv.languages')}
              icon={<Languages size={14} />}
              placeholder={t('doctor.settings.cv.languagesPlaceholder')}
              addLabel={t('doctor.settings.cv.add', { name: t('doctor.settings.cv.languages').toLowerCase() })}
              items={form.languages}
              onChange={(languages) => setForm((f) => ({ ...f, languages }))}
            />
          </div>
        </Card>

        {/* Action bar */}
        <div className="sticky bottom-4 z-10">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg shadow-slate-200/50 px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {error ? (
                <span className="text-red-600 font-bold">{error}</span>
              ) : savedAt ? (
                <span className="text-emerald-600 font-bold inline-flex items-center gap-1">
                  <CheckCircle2 size={12} /> {t('doctor.settings.footer.savedAt', { time: savedAt.toLocaleTimeString() })}
                </span>
              ) : (
                <>{t('doctor.settings.footer.requiredHint')}</>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-200 flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? t('doctor.settings.footer.savingBtn') : t('doctor.settings.footer.saveBtn')}
            </button>
          </div>
        </div>
      </form>

      {/* Local styles for inputs */}
      <style>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border-radius: 0.75rem;
          border: 1px solid rgb(226 232 240);
          background: rgb(248 250 252);
          font-size: 0.875rem;
          color: rgb(15 23 42);
          outline: none;
          transition: all 0.15s;
        }
        .input:focus {
          border-color: rgb(59 130 246);
          background: white;
          box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
        }
      `}</style>
    </div>
  );
}

function Field({ label, hint, icon, children }: {
  label: string; hint?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <label className="block mt-3 first:mt-0">
      <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 mb-1.5">
        {icon} {label}
      </span>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </label>
  );
}

function ListEditor({ label, icon, placeholder, addLabel, items, onChange }: {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  addLabel: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 mb-2">
        {icon} {label}
      </p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
              className="input"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
              title={addLabel}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
        >
          <Plus size={12} /> {addLabel}
        </button>
      </div>
    </div>
  );
}
