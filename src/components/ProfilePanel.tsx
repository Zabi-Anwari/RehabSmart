import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Save, CheckCircle, AlertCircle, User as UserIcon } from 'lucide-react';
import { useAuth } from './AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { InjuryType } from '../types';

interface ProfilePanelProps {
  open: boolean;
  onClose: () => void;
}

const INJURY_OPTIONS: { value: InjuryType; label: string; color: string; active: string }[] = [
  { value: 'Hand',    label: 'Hand',    color: 'border-slate-200 text-slate-500 hover:border-slate-300', active: 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm' },
  { value: 'Wrist',   label: 'Wrist',   color: 'border-slate-200 text-slate-500 hover:border-slate-300', active: 'bg-pink-50 border-pink-300 text-pink-700 shadow-sm' },
  { value: 'Elbow',   label: 'Elbow',   color: 'border-slate-200 text-slate-500 hover:border-slate-300', active: 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm' },
  { value: 'Knee',    label: 'Knee',    color: 'border-slate-200 text-slate-500 hover:border-slate-300', active: 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm' },
  { value: 'Leg',     label: 'Leg',     color: 'border-slate-200 text-slate-500 hover:border-slate-300', active: 'bg-green-50 border-green-300 text-green-700 shadow-sm' },
  { value: 'Walking', label: 'Walking', color: 'border-slate-200 text-slate-500 hover:border-slate-300', active: 'bg-teal-50 border-teal-300 text-teal-700 shadow-sm' },
];

export function ProfilePanel({ open, onClose }: ProfilePanelProps) {
  const { profile, user } = useAuth();

  const [name, setName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [injuryType, setInjuryType] = useState<InjuryType>('Knee');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile && open) {
      setName(profile.name || '');
      setAge(profile.age ?? '');
      setInjuryType(profile.injuryType || 'Knee');
      setSaved(false);
      setError('');
    }
  }, [profile, open]);

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (ev) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const MAX = 240;
          const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    setError('');
    try {
      const base64 = await compressImage(file);
      await updateDoc(doc(db, 'users', user.uid), { photoUrl: base64 });
    } catch (err: any) {
      console.error('Photo save error:', err);
      if (err?.code === 'permission-denied') {
        setError('Firebase rules need updating before photos can be saved. See instructions below.');
      } else {
        setError('Photo save failed. Please try again.');
      }
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        age: age === '' ? null : Number(age),
        injuryType,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error('Profile save error:', err);
      if (err?.code === 'permission-denied') {
        setError('Firebase rules need updating. Deploy firestore.rules to Firebase Console first.');
      } else {
        setError('Failed to save changes. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const initials = (profile?.name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const inputClass =
    'w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50"
          />

          {/* Slide-over panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">My Profile</h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">View and update your information</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Avatar section */}
              <div className="flex flex-col items-center py-8 px-6 border-b border-slate-50">
                <div className="relative mb-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="relative w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700 ring-4 ring-blue-100 flex items-center justify-center group hover:ring-blue-200 transition-all"
                  >
                    {profile?.photoUrl ? (
                      <img src={profile.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-extrabold text-white select-none">{initials}</span>
                    )}
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {uploadingPhoto ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera size={20} className="text-white" />
                      )}
                    </div>
                  </button>
                  <div className="absolute bottom-1 right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm pointer-events-none">
                    <Camera size={10} className="text-white" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 font-medium">Click photo to upload a new one</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>

              {/* Form */}
              <form onSubmit={handleSave} className="px-6 py-6 space-y-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your full name"
                    required
                    className={inputClass}
                  />
                </div>

                {/* Email — read only */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-sm text-slate-500 truncate flex-1">{profile?.email}</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full shrink-0">
                      READ ONLY
                    </span>
                  </div>
                </div>

                {/* Age */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Age</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={age}
                    onChange={e => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Your age"
                    className={inputClass}
                  />
                </div>

                {/* Rehabilitation Focus */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rehabilitation Focus</label>
                  <div className="grid grid-cols-3 gap-2">
                    {INJURY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setInjuryType(opt.value)}
                        className={`py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                          injuryType === opt.value ? opt.active : `bg-white ${opt.color}`
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 text-xs font-semibold text-red-500 bg-red-50 px-3 py-2.5 rounded-xl border border-red-100"
                    >
                      <AlertCircle size={14} className="shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Save button */}
                <button
                  type="submit"
                  disabled={saving}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed ${
                    saved
                      ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                  }`}
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : saved ? (
                    <>
                      <CheckCircle size={16} />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </form>

              {/* Account type badge */}
              <div className="px-6 pb-8">
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <UserIcon size={17} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800">
                      {profile?.role === 'doctor' ? 'Healthcare Provider' : 'Patient'}
                    </p>
                    <p className="text-[11px] text-slate-400">Account type · cannot be changed</p>
                  </div>
                  <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shrink-0 ${
                    profile?.role === 'doctor'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {profile?.role}
                  </span>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
