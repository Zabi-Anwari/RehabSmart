import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  isSupportedLanguage,
  type SupportedLanguage,
} from '../lib/i18n';

/**
 * Globe-button language switcher for the top bar. Click → dropdown of
 * EN · RU · KK. Persists to localStorage (via i18next-browser-languagedetector)
 * and, when the user is signed in, mirrors to users/{uid}.language so the
 * preference follows them across devices.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const current: SupportedLanguage = isSupportedLanguage(i18n.language) ? i18n.language : 'en';

  const select = async (lang: SupportedLanguage) => {
    setOpen(false);
    if (lang === current) return;
    await i18n.changeLanguage(lang);
    // Persist to Firestore for signed-in users so the choice follows them
    // across devices. Best-effort: a failure here doesn't undo the local
    // change — the language detector already updated localStorage.
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { language: lang });
      } catch {
        // Profile may not exist yet (mid-signup) — silently ignore.
      }
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('common.selectLanguage')}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl text-xs font-bold transition-all border',
          compact ? 'p-2' : 'px-3 py-1.5',
          open
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
        )}
      >
        <Globe size={compact ? 16 : 14} />
        {!compact && (
          <span className="uppercase">{current}</span>
        )}
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50"
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isActive = lang === current;
            return (
              <li key={lang}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => select(lang)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 w-6">
                      {lang}
                    </span>
                    <span className="font-semibold">{LANGUAGE_LABELS[lang].native}</span>
                  </span>
                  {isActive && <Check size={14} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
