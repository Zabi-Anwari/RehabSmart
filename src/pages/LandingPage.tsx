import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Dumbbell,
  LineChart,
  Users,
  Camera,
  Cpu,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  MoveRight
} from 'lucide-react';
import { FeatureCard } from '../components/Cards';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

// Static gradient orbs — animating multiple blur-[120px] elements at once
// pegged the GPU and made the laptop hot/laggy while the landing page was open.
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-blue-400/10 blur-[80px]" />
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-400/10 blur-[80px]" />
    </div>
  );
}

export function LandingPage() {
  const { t } = useTranslation();
  const features = [
    { title: t('landing.features.1.title'), desc: t('landing.features.1.desc'), icon: Dumbbell    },
    { title: t('landing.features.2.title'), desc: t('landing.features.2.desc'), icon: Camera      },
    { title: t('landing.features.3.title'), desc: t('landing.features.3.desc'), icon: LineChart   },
    { title: t('landing.features.4.title'), desc: t('landing.features.4.desc'), icon: Stethoscope },
    { title: t('landing.features.5.title'), desc: t('landing.features.5.desc'), icon: Cpu         },
    { title: t('landing.features.6.title'), desc: t('landing.features.6.desc'), icon: ShieldCheck },
  ];

  const rehabAreas = [
    { name: t('injuries.Elbow'), color: 'bg-blue-500'    },
    { name: t('injuries.Knee'),  color: 'bg-emerald-500' },
    { name: t('injuries.Leg'),   color: 'bg-indigo-500'  },
  ];

  const steps = [
    { title: t('landing.howitworks.1.title'), desc: t('landing.howitworks.1.desc') },
    { title: t('landing.howitworks.2.title'), desc: t('landing.howitworks.2.desc') },
    { title: t('landing.howitworks.3.title'), desc: t('landing.howitworks.3.desc') },
    { title: t('landing.howitworks.4.title'), desc: t('landing.howitworks.4.desc') },
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity className="text-blue-600" size={32} />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">RehabSmart</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-blue-600 transition-colors">{t('landing.nav.features')}</a>
          <a href="#how-it-works" className="hover:text-blue-600 transition-colors">{t('landing.nav.howItWorks')}</a>
          <div className="h-4 w-px bg-slate-200" />
          <LanguageSwitcher />
          <Link to="/auth" className="px-5 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all font-semibold shadow-md shadow-blue-200 flex items-center gap-2">
            {t('landing.nav.patientPortal')} <ArrowRight size={16} />
          </Link>
        </div>
      </nav>

      {/* ─── Hero Section ───────────────────────────────────────────────────── */}
      <section className="relative max-w-7xl mx-auto px-6 py-20 lg:py-32 grid lg:grid-cols-2 gap-16 items-center overflow-hidden">
        <AnimatedBackground />

        {/* Left — copy */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-600 text-sm font-bold tracking-wide uppercase mb-6">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            {t('landing.hero.badge')}
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-8">
            {t('landing.hero.headlinePart1')} <span className="text-blue-600">{t('landing.hero.headlinePart2')}</span>
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed mb-10 max-w-lg">
            {t('landing.hero.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Link to="/auth" className="flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-bold text-lg">
              {t('landing.hero.ctaPrimary')} <ArrowRight size={20} />
            </Link>
            <Link to="/doctor" className="flex items-center justify-center gap-2 px-8 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl hover:border-blue-600 hover:text-blue-600 transition-all font-bold text-lg">
              {t('landing.hero.ctaSecondary')}
            </Link>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} alt="Patient" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500 font-medium font-mono uppercase tracking-wider">{t('landing.hero.socialProof')}</p>
          </div>
        </motion.div>

        {/* Right — dashboard mockup (fully contained, no overflow) */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative z-10"
        >
          {/* Window frame */}
          <div className="bg-slate-900 rounded-[2.5rem] p-2 md:p-3 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
            {/* Traffic-light dots */}
            <div className="absolute inset-x-3 top-3 h-6 flex items-center px-5 gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
            </div>

            {/* Inner white shell */}
            <div className="bg-white rounded-[2rem] mt-6 overflow-hidden border border-slate-100 shadow-inner">

              {/* App header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-400/20">R</div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 leading-none">Clinic Portal</p>
                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-tight mt-0.5">Session: ACTIVE_04</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Protocol</p>
                    <p className="text-[10px] font-bold text-blue-600">RFC-7022</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-100 ring-2 ring-white shadow-sm" />
                </div>
              </div>

              {/* Main content — 2-column grid, fully inside */}
              <div className="p-5 grid grid-cols-2 gap-4">

                {/* ── Left column ── */}
                <div className="space-y-3">
                  {/* Recovery card */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Weekly Recovery</p>
                    <div className="flex items-end gap-2 mb-3">
                      <span className="text-3xl font-black text-slate-900">82.4%</span>
                      <span className="text-xs font-bold text-green-500 mb-0.5">+4.2%</span>
                    </div>
                    <div className="flex gap-0.5 h-10 items-end">
                      {[40, 70, 45, 90, 65, 85, 95].map((h, i) => (
                        <div key={i} className="flex-1 bg-blue-200/60 group-hover:bg-blue-400/40 transition-colors rounded-t-sm" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>

                  {/* Pain + Mobility mini cards */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 border border-slate-100 rounded-xl">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Pain Level</p>
                      <p className="text-base font-black text-slate-900 italic">Level 2</p>
                    </div>
                    <div className="p-3 border border-slate-100 rounded-xl">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Mobility</p>
                      <p className="text-base font-black text-slate-900">High</p>
                    </div>
                  </div>
                </div>

                {/* ── Right column ── */}
                <div className="space-y-3">
                  {/* AI Link status card */}
                  <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]" />
                        <span className="text-[9px] font-bold text-white font-mono tracking-tight">AI_LINK_STABLE</span>
                      </div>
                      <Cpu size={11} className="text-blue-400" />
                    </div>
                    {/* Mini visualisation */}
                    <div className="aspect-video bg-slate-800/80 rounded-xl mb-2 overflow-hidden relative">
                      <svg className="absolute inset-0 w-full h-full p-3 text-blue-500/40" viewBox="0 0 100 60">
                        <circle cx="50" cy="30" r="24" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 2" />
                        <path d="M50 6 L50 54 M26 30 L74 30" stroke="currentColor" strokeWidth="0.5" />
                        <motion.path
                          animate={{ d: ['M36,18 L50,9 L64,18 L50,27 Z', 'M40,21 L50,12 L60,21 L50,30 Z'] }}
                          transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                          fill="#3b82f6"
                          fillOpacity="0.45"
                        />
                      </svg>
                      <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent">
                        <div className="flex justify-between text-[7px] font-mono font-bold text-white/70 uppercase">
                          <span>Sync: 0.12ms</span>
                          <span>60fps</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">Movement Calibration</p>
                    <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-500 rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: '92%' }}
                        transition={{ duration: 2, delay: 0.5 }}
                      />
                    </div>
                  </div>

                  {/* Treatment Adherence */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">Treatment Adherence</p>
                    {[
                      { l: 'Knee Extensions',   p: 95, c: 'bg-blue-500' },
                      { l: 'Quad Strength.',    p: 78, c: 'bg-cyan-500' },
                      { l: 'Gait Retraining',   p: 42, c: 'bg-slate-300' },
                    ].map((item) => (
                      <div key={item.l} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-700">{item.l}</span>
                          <span className="text-[9px] font-mono text-slate-400">{item.p}%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            className={cn('h-full rounded-full', item.c)}
                            initial={{ width: '0%' }}
                            animate={{ width: `${item.p}%` }}
                            transition={{ duration: 1.2, delay: 0.8 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── Areas Section ─────────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-12 flex items-center gap-3">
            {t('landing.areas.title')} <MoveRight className="text-blue-600" />
          </h2>
          <div className="flex flex-wrap gap-4">
            {rehabAreas.map((area) => (
              <div key={area.name} className="flex items-center gap-3 px-6 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-default">
                <div className={cn('w-3 h-3 rounded-full', area.color)} />
                <span className="font-bold text-slate-700">{area.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─────────────────────────────────────────────────── */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <h2 className="text-4xl font-bold text-slate-900 mb-6 tracking-tight">{t('landing.features.headline')}</h2>
          <p className="text-lg text-slate-600">{t('landing.features.description')}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f) => (
            <FeatureCard key={f.title} title={f.title} desc={f.desc} icon={f.icon} />
          ))}
        </div>
      </section>

      {/* ─── How it Works ──────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="mb-20">
            <h2 className="text-4xl font-bold mb-6">{t('landing.howitworks.headline')}</h2>
            <p className="text-slate-400 text-lg">{t('landing.howitworks.description')}</p>
          </div>
          <div className="grid md:grid-cols-4 gap-12">
            {steps.map((step, idx) => (
              <div key={step.title} className="relative group">
                <div className="text-6xl font-black text-white/5 absolute -top-8 -left-4 group-hover:text-blue-500/10 transition-colors">0{idx + 1}</div>
                <h3 className="text-xl font-bold mb-3 relative">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────────── */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-2">
          <Activity className="text-blue-600" size={24} />
          <span className="text-lg font-bold text-slate-900 uppercase tracking-widest">RehabSmart</span>
        </div>
        <div className="flex gap-10 text-sm text-slate-500 font-medium">
          <a href="#" className="hover:text-blue-600 transition-colors">{t('landing.footer.privacy')}</a>
          <a href="#" className="hover:text-blue-600 transition-colors">{t('landing.footer.terms')}</a>
          <a href="#" className="hover:text-blue-600 transition-colors">{t('landing.footer.support')}</a>
        </div>
        <p className="text-xs text-slate-400 font-mono tracking-tighter">{t('landing.footer.copyright')}</p>
      </footer>
    </div>
  );
}
