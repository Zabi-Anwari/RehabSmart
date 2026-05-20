import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AIAssistant } from './AIAssistant';
import {
  LayoutDashboard,
  Dumbbell,
  LineChart,
  Users,
  Cpu,
  Menu,
  X,
  Activity,
  LogOut,
  User as UserIcon,
  ClipboardList,
  ChevronDown,
  Check,
  MessageCircle,
  Stethoscope,
  Settings,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './AuthContext';
import { useRehab } from '../context/RehabContext';
import { ProfilePanel } from './ProfilePanel';
import { REHAB_MODULES } from '../constants';
import { RehabType, Connection } from '../types';
import {
  subscribeConnectionsForDoctor,
  subscribeConnectionsForPatient,
} from '../lib/connections';

// Sidebar switcher — clicking "Active Program" pops a small menu with all
// rehab modules. Selecting one updates the context and routes to that
// module's dashboard, so the rest of the sidebar (which is type-scoped) and
// the page content both rerender against the new type.
function RehabProgramSwitcher({ onAfterSelect }: { onAfterSelect?: () => void }) {
  const { rehabType, setRehabType } = useRehab();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const active = REHAB_MODULES[rehabType];

  const select = (type: RehabType) => {
    setOpen(false);
    if (type !== rehabType) {
      setRehabType(type);
      navigate(`/rehab/${type}/dashboard`);
    }
    onAfterSelect?.();
  };

  return (
    <div ref={containerRef} className="relative mx-4 mb-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full px-3 py-2 rounded-xl border text-left flex items-center gap-2 transition-all hover:shadow-sm',
          active.colors.light, active.colors.border,
        )}
      >
        <div className="flex-1 min-w-0">
          <p className={cn('text-[10px] font-bold uppercase tracking-widest', active.colors.text)}>
            {t('layout.sidebar.activeProgram')}
          </p>
          <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{t(`rehab.${rehabType}`)}</p>
        </div>
        <ChevronDown
          size={14}
          className={cn('flex-shrink-0 transition-transform text-slate-500', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50"
          >
            {(['knee', 'leg', 'elbow'] as RehabType[]).map(type => {
              const mod = REHAB_MODULES[type];
              const isActive = type === rehabType;
              return (
                <li key={type}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => select(type)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                      isActive ? cn(mod.colors.light, mod.colors.textDark) : 'hover:bg-slate-50 text-slate-700',
                    )}
                  >
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', mod.colors.bar)} />
                    <span className="flex-1 font-semibold">{t(`rehab.${type}`)}</span>
                    {isActive && <Check size={14} className={mod.colors.text} />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const { profile, user, signOut, loading } = useAuth();
  const { rehabType } = useRehab();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Live unread count across all conversations involving this user. Used by
  // the Messages buttons in the top bar + sidebar to render a red dot/badge
  // without each consumer re-subscribing. Patients query connections where
  // patientUid == them; doctors query where doctorUid == them.
  const [unreadTotal, setUnreadTotal] = React.useState(0);
  React.useEffect(() => {
    if (!user || !profile) return;
    const handler = (conns: Connection[]) => {
      const total = conns
        .filter((c) => c.status === 'accepted')
        .reduce((sum, c) => sum + (profile.role === 'doctor' ? c.doctorUnread : c.patientUnread), 0);
      setUnreadTotal(total);
    };
    const unsub = profile.role === 'doctor'
      ? subscribeConnectionsForDoctor(user.uid, handler)
      : subscribeConnectionsForPatient(user.uid, handler);
    return () => unsub();
  }, [user, profile]);

  const isLanding = location.pathname === '/';
  const isAuth = location.pathname === '/auth';

  // These pages manage their own full-page layout
  if (isLanding || isAuth) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Rehab-type colour tokens for dynamic sidebar accent
  const rehabColors = REHAB_MODULES[rehabType].colors;
  const activeAccent = rehabColors.text;
  const activeBg    = rehabColors.light;

  // Patient nav: type-scoped paths so each body-part stays isolated. The
  // Find-My-Doctor and Messages links are global (not body-part-scoped) and
  // also live in the top bar — listing them in the sidebar ensures they
  // appear in the mobile drawer where the top bar is collapsed.
  const patientNav = [
    { name: t('layout.nav.dashboard'),  path: `/rehab/${rehabType}/dashboard`, icon: LayoutDashboard },
    { name: t('layout.nav.exercises'),  path: `/rehab/${rehabType}/exercises`, icon: Dumbbell },
    { name: t('layout.nav.progress'),   path: `/rehab/${rehabType}/progress`,  icon: LineChart },
    { name: t('layout.nav.plan'),       path: `/rehab/${rehabType}/plan`,      icon: ClipboardList },
    { name: t('layout.nav.ml'),         path: `/rehab/${rehabType}/ml`,        icon: Cpu },
    { name: t('layout.nav.findDoctor'), path: '/find-doctor',                  icon: Stethoscope },
    { name: t('layout.nav.messages'),   path: '/messages',                     icon: MessageCircle },
  ];

  // Doctor nav — patients, messaging, and the CV settings page.
  const doctorNav = [
    { name: t('layout.nav.patients'), path: '/doctor',          icon: Users    },
    { name: t('layout.nav.messages'), path: '/messages',        icon: MessageCircle },
    { name: t('layout.nav.settings'), path: '/doctor/settings', icon: Settings },
  ];

  const navItems = profile?.role === 'doctor' ? doctorNav : patientNav;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const initials = (profile?.name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const NavItems = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end
          onClick={onItemClick}
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
            isActive
              ? cn(activeBg, activeAccent, 'shadow-sm')
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          )}
        >
          {({ isActive }) => (
            <>
              <item.icon
                size={20}
                className={cn('transition-colors', isActive ? activeAccent : 'text-slate-400')}
              />
              {item.name}
            </>
          )}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ── Desktop top bar ─────────────────────────────────────────────── */}
      <header className="hidden lg:flex fixed top-0 left-64 right-0 h-14 bg-white border-b border-slate-100 items-center justify-end gap-2 px-6 z-40">
        {/* Quick links — only for signed-in users with a role (not on auth flow). */}
        {profile?.role === 'patient' && (
          <NavLink
            to="/find-doctor"
            className={({ isActive }) => cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
              isActive
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
            )}
          >
            <Stethoscope size={14} /> {t('layout.topbar.findDoctor')}
          </NavLink>
        )}
        {profile && (
          <NavLink
            to="/messages"
            className={({ isActive }) => cn(
              'relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
              isActive
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
            )}
            title={t('layout.topbar.messages')}
          >
            <MessageCircle size={14} /> {t('layout.topbar.messages')}
            {unreadTotal > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                {unreadTotal > 9 ? '9+' : unreadTotal}
              </span>
            )}
          </NavLink>
        )}
        <LanguageSwitcher />
        <div className="w-px h-6 bg-slate-200 mx-1" aria-hidden />
        <button
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
          title={t('layout.topbar.profileTooltip')}
        >
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-800 leading-none">{profile?.name}</p>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight mt-0.5">
              {profile?.role === 'doctor'
                ? t('profile.accountTypeDoctor')
                : t('profile.accountTypePatient')}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center ring-2 ring-blue-100">
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-extrabold text-white select-none">{initials}</span>
            )}
          </div>
        </button>
      </header>

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 bg-white border-r border-slate-200 z-50">
        {/* Logo */}
        <div className="p-6 flex items-center gap-2">
          <div className={cn('p-2 rounded-lg text-white', rehabColors.primary)}>
            <Activity size={24} />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">RehabSmart</span>
        </div>

        {/* Active program switcher */}
        {profile?.role === 'patient' && <RehabProgramSwitcher />}

        <nav className="flex-1 px-4 space-y-1">
          <NavItems />
        </nav>

        <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
          {profile && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <UserIcon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{profile.name}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                  {profile.role === 'doctor'
                    ? t('profile.accountTypeDoctor')
                    : t('profile.accountTypePatient')}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all w-full"
          >
            <LogOut size={20} />
            {t('layout.nav.signOut')}
          </button>
        </div>
      </aside>

      {/* ── Mobile header ───────────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 w-full bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-40">
        <div className="flex items-center gap-2">
          <Activity className="text-blue-600" size={24} />
          <span className="text-lg font-bold text-slate-900">RehabSmart</span>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher compact />
          {profile && (
            <NavLink
              to="/messages"
              className="relative p-2 text-slate-600 hover:bg-slate-50 rounded-lg"
              title={t('layout.topbar.messages')}
            >
              <MessageCircle size={22} />
              {unreadTotal > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                  {unreadTotal > 9 ? '9+' : unreadTotal}
                </span>
              )}
            </NavLink>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed inset-y-0 left-0 w-72 bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="text-blue-600" size={24} />
                  <span className="text-xl font-bold text-slate-900">RehabSmart</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2">
                  <X size={24} className="text-slate-500" />
                </button>
              </div>

              {profile?.role === 'patient' && (
                <RehabProgramSwitcher onAfterSelect={() => setIsSidebarOpen(false)} />
              )}

              <nav className="flex-1 px-4 space-y-1">
                <NavItems onItemClick={() => setIsSidebarOpen(false)} />
              </nav>

              <div className="p-6 border-t border-slate-100">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all w-full"
                >
                  <LogOut size={20} />
                  {t('layout.nav.signOut')}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1 pt-16 lg:pt-14 lg:pl-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Profile slide-over */}
      <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* AI Assistant floating chat */}
      <AIAssistant />
    </div>
  );
}
