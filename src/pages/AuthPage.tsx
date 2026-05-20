import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, Mail, Lock, User, ArrowRight, ArrowLeft, TrendingUp, Shield, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InjuryType, RehabType } from '../types';
import { useRehab } from '../context/RehabContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

// Maps the broader "injury area" picked during signup to one of the three
// rehab modules the app supports today. Unsupported choices (Hand / Wrist /
// Walking) fall back to knee — the user can still switch via the sidebar.
function injuryToRehabType(injury: InjuryType): RehabType {
  if (injury === 'Leg' || injury === 'Walking') return 'leg';
  if (injury === 'Elbow' || injury === 'Wrist' || injury === 'Hand') return 'elbow';
  return 'knee';
}

const R1 = 84;
const C1 = 2 * Math.PI * R1;
const R2 = 64;
const C2 = 2 * Math.PI * R2;

function RehabIllustration() {
  const { t } = useTranslation();
  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 220 220" className="w-64 h-64" xmlns="http://www.w3.org/2000/svg">
        {/* Outer progress ring */}
        <circle cx="110" cy="110" r={R1} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <circle
          cx="110" cy="110" r={R1}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="7"
          strokeDasharray={`${0.76 * C1} ${C1}`}
          strokeLinecap="round"
          transform="rotate(-90 110 110)"
        />
        {/* Inner progress ring */}
        <circle cx="110" cy="110" r={R2} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          cx="110" cy="110" r={R2}
          fill="none"
          stroke="rgba(147,197,253,0.45)"
          strokeWidth="5"
          strokeDasharray={`${0.58 * C2} ${C2}`}
          strokeLinecap="round"
          transform="rotate(-90 110 110)"
        />

        {/* Human figure — shoulder-raise rehab exercise */}
        {/* Head */}
        <circle cx="110" cy="64" r="13" fill="rgba(255,255,255,0.92)" />
        {/* Torso */}
        <path
          d="M104,77 C102,91 101,107 101,119 C101,125 105,128 110,128 C115,128 119,125 119,119 C119,107 118,91 116,77 Z"
          fill="rgba(255,255,255,0.85)"
        />
        {/* Left arm — relaxed */}
        <path d="M103,90 Q90,104 82,116" stroke="rgba(255,255,255,0.85)" strokeWidth="8" strokeLinecap="round" fill="none" />
        {/* Right arm — raised (rehabilitation exercise) */}
        <path d="M117,88 Q130,74 141,61" stroke="rgba(255,255,255,0.85)" strokeWidth="8" strokeLinecap="round" fill="none" />
        {/* Left leg */}
        <path d="M106,128 Q100,145 96,162" stroke="rgba(255,255,255,0.85)" strokeWidth="8" strokeLinecap="round" fill="none" />
        {/* Right leg */}
        <path d="M114,128 Q120,145 124,162" stroke="rgba(255,255,255,0.85)" strokeWidth="8" strokeLinecap="round" fill="none" />

        {/* Shoulder joint highlight (rehab target) */}
        <circle cx="141" cy="61" r="14" fill="rgba(96,165,250,0.18)" stroke="rgba(147,197,253,0.35)" strokeWidth="1" />
        <circle cx="141" cy="61" r="9" fill="rgba(96,165,250,0.3)" stroke="#93c5fd" strokeWidth="1.5" />
        <circle cx="141" cy="61" r="4" fill="rgba(147,197,253,0.95)" />

        {/* Recovery label */}
        <text x="110" y="190" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="11" fontWeight="600" fontFamily="system-ui">
          {t('auth.panel.recovered', { percent: 76 })}
        </text>
      </svg>

      {/* Floating stat chips */}
      <div className="absolute -top-2 -right-6 bg-white/15 backdrop-blur-md rounded-xl px-3 py-2 border border-white/25 text-white shadow-lg">
        <p className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider mb-0.5">{t('auth.panel.sessions')}</p>
        <p className="text-xl font-extrabold leading-none">24 <span className="text-sm font-medium text-blue-200">/ 30</span></p>
      </div>
      <div className="absolute -bottom-2 -left-6 bg-white/15 backdrop-blur-md rounded-xl px-3 py-2 border border-white/25 text-white shadow-lg">
        <p className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider mb-0.5">{t('auth.panel.painLevel')}</p>
        <p className="text-xl font-extrabold leading-none">3.2 <span className="text-sm font-medium text-blue-200">/ 10</span></p>
      </div>
    </div>
  );
}

function RehabPanel() {
  const { t } = useTranslation();
  return (
    <div className="hidden lg:flex w-[52%] relative overflow-hidden flex-col items-center justify-center p-12"
      style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 45%, #4338ca 100%)' }}
    >
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-[30rem] h-[30rem] rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="rehab-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.3" fill="rgba(255,255,255,0.13)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rehab-dots)" />
      </svg>

      <div className="relative z-10 flex flex-col items-center w-full max-w-xs">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex p-3.5 bg-white/15 backdrop-blur-sm rounded-2xl mb-3 shadow-xl shadow-blue-950/40">
            <Activity size={34} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{t('auth.panel.brand')}</h1>
          <p className="text-blue-200 text-sm font-medium mt-1.5">{t('auth.panel.tagline')}</p>
        </div>

        {/* Illustration */}
        <div className="mb-10">
          <RehabIllustration />
        </div>

        {/* Feature list */}
        <div className="space-y-3 w-full">
          {([
            [TrendingUp, t('auth.panel.feature1')],
            [Shield,     t('auth.panel.feature2')],
            [Users,      t('auth.panel.feature3')],
          ] as const).map(([Icon, text]) => (
            <div key={text} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/15">
                <Icon size={14} className="text-blue-200" />
              </div>
              <span className="text-sm text-blue-100 font-medium">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [injury, setInjury] = useState<InjuryType>('Knee');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { setRehabType } = useRehab();
  const { t } = useTranslation();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    let nextRehabType: RehabType = 'knee';
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          const path = `users/${user.uid}`;
          try {
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              name: user.displayName || email.split('@')[0],
              email,
              role: 'patient',
              injuryType: 'Knee' as InjuryType,
              recoveryProgress: 0,
              createdAt: serverTimestamp()
            });
          } catch (dbErr) {
            handleFirestoreError(dbErr, OperationType.WRITE, path);
          }
        } else {
          const data = userDoc.data() as { injuryType?: InjuryType };
          if (data.injuryType) nextRehabType = injuryToRehabType(data.injuryType);
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const path = `users/${user.uid}`;
        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name,
            email,
            role,
            injuryType: role === 'patient' ? injury : null,
            recoveryProgress: 0,
            createdAt: serverTimestamp()
          });
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.WRITE, path);
        }
        if (role === 'patient') nextRehabType = injuryToRehabType(injury);
      }
      setRehabType(nextRehabType);
      navigate(`/rehab/${nextRehabType}/dashboard`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true);
    let nextRehabType: RehabType = 'knee';
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const path = `users/${user.uid}`;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name: user.displayName || 'Google User',
            email: user.email,
            role: 'patient',
            injuryType: 'Knee' as InjuryType,
            recoveryProgress: 0,
            createdAt: serverTimestamp()
          });
        } else {
          const data = userDoc.data() as { injuryType?: InjuryType };
          if (data.injuryType) nextRehabType = injuryToRehabType(data.injuryType);
        }
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, path);
      }
      setRehabType(nextRehabType);
      navigate(`/rehab/${nextRehabType}/dashboard`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all";

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left — rehabilitation illustration */}
      <RehabPanel />

      {/* Right — form panel */}
      <div className="w-full lg:w-[48%] flex flex-col bg-white min-h-screen shadow-[-2px_0_24px_rgba(0,0,0,0.04)]">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 pt-7 pb-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={15} />
            {t('common.back')}
          </Link>
          <LanguageSwitcher />
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-sm"
          >
            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {isLogin ? t('auth.login.title') : t('auth.signup.title')}
              </h2>
              <p className="text-slate-500 text-sm mt-1.5">
                {isLogin ? t('auth.login.subtitle') : t('auth.signup.subtitle')}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex p-1 bg-slate-100 rounded-xl mb-7">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {t('auth.tabs.signin')}
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {t('auth.tabs.signup')}
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <AnimatePresence initial={false}>
                {!isLogin && (
                  <motion.div
                    key="signup-fields"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{t('auth.form.name')}</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          required
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t('auth.form.namePlaceholder')}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {/* Role */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{t('auth.form.role')}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRole('patient')}
                          className={`py-2.5 text-sm font-bold rounded-xl border transition-all ${role === 'patient' ? 'bg-blue-50 border-blue-300 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        >
                          {t('auth.form.rolePatient')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole('doctor')}
                          className={`py-2.5 text-sm font-bold rounded-xl border transition-all ${role === 'doctor' ? 'bg-blue-50 border-blue-300 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        >
                          {t('auth.form.roleDoctor')}
                        </button>
                      </div>
                    </div>

                    {/* Injury area */}
                    {role === 'patient' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-1.5"
                      >
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{t('auth.form.injury')}</label>
                        <select
                          value={injury}
                          onChange={(e) => setInjury(e.target.value as InjuryType)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207L10%2012L15%207%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat transition-all"
                        >
                          {(['Hand', 'Wrist', 'Elbow', 'Knee', 'Leg', 'Walking'] as InjuryType[]).map(opt => (
                            <option key={opt} value={opt}>{t(`injuries.${opt}`)}</option>
                          ))}
                        </select>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{t('auth.form.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.form.emailPlaceholder')}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{t('auth.form.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.form.passwordPlaceholder')}
                    className={inputClass}
                  />
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs font-semibold text-red-500 px-1"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                disabled={loading}
                type="submit"
                className="w-full mt-2 py-3.5 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('auth.form.loading') : (isLogin ? t('auth.form.signinBtn') : t('auth.form.signupBtn'))}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t('auth.divider')}</span>
              </div>
            </div>

            {/* Google */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              {t('auth.oauth.google')}
            </button>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-7 text-center text-xs text-slate-400 leading-relaxed">
          {t('auth.footer.agree')}{' '}
          <span className="text-slate-500 underline cursor-pointer">{t('auth.footer.tos')}</span>{' '}
          {t('auth.footer.and')}{' '}
          <span className="text-slate-500 underline cursor-pointer">{t('auth.footer.privacy')}</span>.
          {' '}{t('auth.footer.security')}
        </div>
      </div>
    </div>
  );
}
