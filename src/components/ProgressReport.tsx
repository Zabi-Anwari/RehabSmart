/**
 * Printable patient progress report.
 *
 * Renders a full-screen overlay (portal on <body>) with an A4-style "paper".
 * "Print / Save as PDF" calls window.print(); the print stylesheet in
 * index.css hides the rest of the app so only the report is printed.
 *
 * All wording comes from i18n templates (progress.report.*) filled with facts
 * from lib/progressReport.ts — rule-based text generation, no ML model.
 */

import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Printer, X, Activity, TrendingUp, TrendingDown, Minus, CheckCircle2,
  AlertTriangle, Info, Lightbulb, CalendarDays, type LucideIcon,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { cn } from '../lib/utils';
import { REHAB_MODULES } from '../constants';
import type { RehabType } from '../types';
import type { SessionRecord } from '../lib/sessions';
import type { RehabMetrics } from '../hooks/useRehabMetrics';
import {
  buildProgressReport, signed,
  type MetricChange, type ReportStatus, type TrendDir,
} from '../lib/progressReport';

export interface ReportPatient {
  name: string;
  age?: number;
  injuryType?: string;
}

interface ProgressReportProps {
  patient: ReportPatient;
  rehabType: RehabType;
  /** Newest-first, as returned by useSessions. */
  sessions: SessionRecord[];
  metrics: RehabMetrics;
  onClose: () => void;
}

const STATUS_STYLE: Record<ReportStatus, { chip: string; icon: LucideIcon }> = {
  early:     { chip: 'bg-slate-100 text-slate-700 border-slate-300',     icon: Info },
  excellent: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-300', icon: CheckCircle2 },
  good:      { chip: 'bg-green-50 text-green-700 border-green-300',       icon: CheckCircle2 },
  steady:    { chip: 'bg-sky-50 text-sky-700 border-sky-300',             icon: Info },
  attention: { chip: 'bg-amber-50 text-amber-800 border-amber-300',       icon: AlertTriangle },
};

// Colour says whether the change is good or bad; the arrow follows the actual
// direction of the number (pain going down is an improvement, shown as a green down-arrow).
const KK_MONTHS = [
  'қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым',
  'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан',
];

const DIR_COLOR: Record<TrendDir, string> = {
  improved: 'text-emerald-600',
  declined: 'text-red-600',
  stable:   'text-slate-500',
};
const deltaIcon = (delta: number): LucideIcon =>
  delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

export function ProgressReport({ patient, rehabType, sessions, metrics, onClose }: ProgressReportProps) {
  const { t, i18n } = useTranslation();
  const mod = REHAB_MODULES[rehabType];
  const accent = mod.colors.chartHex;

  const data = useMemo(
    () => buildProgressReport(rehabType, sessions, metrics),
    [rehabType, sessions, metrics],
  );

  // Some browsers ship without Kazakh month names (they print "M11"), so Kazakh is formatted by hand.
  const isKk = i18n.language.startsWith('kk');
  const fmtDate = (d: Date) => isKk
    ? `${d.getDate()} ${KK_MONTHS[d.getMonth()]} ${d.getFullYear()}`
    : d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtShort = (d: Date) => isKk
    ? `${d.getDate()} ${KK_MONTHS[d.getMonth()]}`
    : d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  const exerciseName = (id: string, fallback: string) =>
    t(`exerciseContent.${id}.title`, { defaultValue: fallback });
  const rt = (key: string, opts?: Record<string, unknown>) => t(`progress.report.${key}`, opts);

  // Lock page scroll while the overlay is open and close on Escape.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const handlePrint = () => {
    // The browser uses the page title as the default PDF file name.
    const prevTitle = document.title;
    const stamp = new Date().toISOString().slice(0, 10);
    document.title = `RehabSmart-${patient.name.replace(/\s+/g, '_')}-${rehabType}-${stamp}`;
    window.print();
    document.title = prevTitle;
  };

  // ── narrative paragraph ────────────────────────────────────────────────────
  const narrative = useMemo(() => {
    if (!data) return [];
    const parts: string[] = [
      t('progress.report.summary.intro', {
        from: fmtDate(data.firstDate),
        to: fmtDate(data.lastDate),
        sessions: data.sessionCount,
        module: t(`rehab.${rehabType}`),
        minutes: data.totalMinutes,
        reps: data.totalReps,
      }),
    ];
    if (data.status === 'early') {
      parts.push(t('progress.report.summary.early'));
      return parts;
    }
    const add = (kind: 'rom' | 'quality' | 'pain', c: MetricChange | null) => {
      if (!c) return;
      parts.push(t(`progress.report.summary.${kind}.${c.dir}`, {
        from: c.baseline, to: c.recent, delta: signed(c.delta),
      }));
    };
    add('rom', data.rom);
    add('quality', data.quality);
    add('pain', data.pain);
    parts.push(t('progress.report.summary.consistency', {
      perWeek: data.sessionsPerWeek, adherence: data.adherencePct,
    }));
    parts.push(t(`progress.report.summary.closing.${data.status}`));
    return parts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, i18n.language, rehabType]);

  // ── key findings & recommendations ─────────────────────────────────────────
  const findings = useMemo(() => {
    if (!data) return [];
    const out: { tone: 'good' | 'warn' | 'info'; text: string }[] = [];
    if (data.bestSession) {
      out.push({ tone: 'good', text: t('progress.report.findings.bestSession', {
        exercise: exerciseName(data.bestSession.exerciseId, data.bestSession.exerciseTitle),
        date: fmtDate(data.bestSession.date),
        quality: Math.round(data.bestSession.quality),
      }) });
    }
    out.push({ tone: 'info', text: t('progress.report.findings.topExercise', {
      exercise: exerciseName(data.topExercise.id, data.topExercise.title),
      count: data.topExercise.count,
    }) });
    if (data.bestRom !== null && data.romPctOfTarget !== null) {
      out.push({ tone: data.flags.romLow ? 'warn' : 'info', text: t('progress.report.findings.romTarget', {
        rom: data.bestRom, pct: data.romPctOfTarget, target: data.targetRom,
      }) });
    }
    out.push({ tone: data.flags.painHigh ? 'warn' : 'info', text: t('progress.report.findings.latestPain', { pain: data.latestPain }) });
    if (data.flags.inactive) {
      out.push({ tone: 'warn', text: t('progress.report.findings.inactive', { days: data.daysSinceLast }) });
    } else if (data.sessionCount >= 3 && !data.flags.adherenceLow) {
      out.push({ tone: 'good', text: t('progress.report.findings.consistent', { perWeek: data.sessionsPerWeek }) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, i18n.language]);

  const recommendations = useMemo(() => {
    if (!data) return [];
    const out: string[] = [];
    const f = data.flags;
    if (f.painHigh) out.push(t('progress.report.recs.painHigh'));
    if (f.inactive) out.push(t('progress.report.recs.inactive', { days: data.daysSinceLast }));
    if (f.adherenceLow) out.push(t('progress.report.recs.adherenceLow'));
    if (f.qualityLow) out.push(t('progress.report.recs.qualityLow'));
    if (f.romLow) out.push(t('progress.report.recs.romLow'));
    if (data.status === 'early') out.push(t('progress.report.recs.early'));
    if ((data.status === 'excellent' || data.status === 'good') && !f.painHigh) {
      out.push(t('progress.report.recs.keepGoing'));
    }
    if (data.sessionsToNextPhase !== null && data.sessionsToNextPhase > 0) {
      out.push(t('progress.report.recs.nextPhase', {
        remaining: data.sessionsToNextPhase, phase: data.phase + 1,
      }));
    }
    out.push(t('progress.report.recs.consultDoctor'));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, i18n.language]);

  if (!data) return null;

  const StatusIcon = STATUS_STYLE[data.status].icon;
  const chartData = data.series.map((p) => ({ ...p, label: fmtShort(p.date) }));
  const recent = sessions.slice(0, 10);

  const kpis = [
    { label: rt('kpi.recovery'),   value: `${data.recoveryPct}%` },
    { label: rt('kpi.phase'),      value: rt('kpi.phaseValue', { phase: data.phase }) },
    { label: rt('kpi.sessions'),   value: String(data.sessionCount) },
    { label: rt('kpi.adherence'),  value: `${data.adherencePct}%` },
    { label: rt('kpi.bestRom'),    value: data.bestRom !== null ? `${data.bestRom}°` : '--' },
    { label: rt('kpi.avgQuality'), value: data.avgQuality !== null ? `${data.avgQuality}%` : '--' },
    { label: rt('kpi.avgPain'),    value: `${data.avgPain}/10` },
    { label: rt('log.reps'),       value: String(data.totalReps) },
  ];

  const compareRows: { label: string; change: MetricChange | null; unit: string; signedUnit: string }[] = [
    { label: rt('compare.rom'),     change: data.rom,     unit: '°',   signedUnit: '°' },
    { label: rt('compare.quality'), change: data.quality, unit: '%',   signedUnit: '' },
    { label: rt('compare.pain'),    change: data.pain,    unit: '/10', signedUnit: '' },
  ];

  const charts = [
    { key: 'rom' as const,     title: rt('trends.rom'),     color: accent,    domain: [0, Math.max(data.targetRom, data.bestRom ?? 0)] as [number, number] },
    { key: 'quality' as const, title: rt('trends.quality'), color: '#6366f1', domain: [0, 100] as [number, number] },
    { key: 'pain' as const,    title: rt('trends.pain'),    color: '#f43f5e', domain: [0, 10] as [number, number] },
  ];

  const infoRows: [string, string][] = [
    [rt('patient.name'), patient.name],
    ...(patient.age ? [[rt('patient.age'), String(patient.age)] as [string, string]] : []),
    ...(patient.injuryType ? [[rt('patient.injury'), t(`injuries.${patient.injuryType}`, { defaultValue: patient.injuryType })] as [string, string]] : []),
    [rt('patient.module'), t(`rehab.${rehabType}`)],
    [rt('patient.period'), `${fmtDate(data.firstDate)} – ${fmtDate(data.lastDate)}`],
  ];

  return createPortal(
    <div className="report-portal fixed inset-0 z-[100] overflow-y-auto bg-slate-200/95 print:bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="report-no-print sticky top-0 z-10 flex items-center justify-between gap-3 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-8 py-3">
        <p className="text-sm font-bold text-slate-700 truncate">{rt('title')}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition-colors', mod.colors.primary, mod.colors.primaryHover)}
          >
            <Printer size={16} />
            <span className="hidden sm:inline">{rt('print')}</span>
          </button>
          <button
            onClick={onClose}
            aria-label={rt('close')}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Paper */}
      <article className="report-paper mx-auto my-6 w-full max-w-[820px] bg-white rounded-xl shadow-xl p-6 sm:p-10 text-slate-800">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 pb-5 border-b-4" style={{ borderColor: accent }}>
          <div>
            <div className="flex items-center gap-2 mb-2" style={{ color: accent }}>
              <Activity size={20} />
              <span className="font-extrabold tracking-tight text-lg">{rt('brand')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">{rt('title')}</h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
              <CalendarDays size={13} />
              {rt('generatedOn', { date: fmtDate(new Date()) })}
            </p>
          </div>
          <div className={cn('shrink-0 text-right rounded-xl border px-3 py-2', STATUS_STYLE[data.status].chip)}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{rt('status.label')}</p>
            <p className="text-sm font-extrabold flex items-center justify-end gap-1.5">
              <StatusIcon size={14} />
              {rt(`status.${data.status}`)}
            </p>
          </div>
        </header>

        {/* Patient info */}
        <section className="report-avoid-break mt-6">
          <h2 className="report-h2">{rt('patient.heading')}</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            {infoRows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-semibold text-slate-900 text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Summary */}
        <section className="report-avoid-break mt-7">
          <h2 className="report-h2">{rt('summary.heading')}</h2>
          <p className="text-[15px] leading-relaxed text-slate-700">{narrative.join(' ')}</p>
        </section>

        {/* KPI tiles */}
        <section className="report-avoid-break mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{k.label}</p>
              <p className="text-xl font-extrabold text-slate-900 mt-0.5">{k.value}</p>
            </div>
          ))}
        </section>

        {/* Then vs now */}
        <section className="report-avoid-break mt-8">
          <h2 className="report-h2">{rt('compare.heading')}</h2>
          {data.windowSize > 0 && (
            <p className="text-xs text-slate-400 -mt-1 mb-2">{rt('compare.subtitle', { k: data.windowSize })}</p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-slate-400 border-b border-slate-200">
                <th className="py-2 font-bold">{rt('compare.metric')}</th>
                <th className="py-2 font-bold">{rt('compare.baseline')}</th>
                <th className="py-2 font-bold">{rt('compare.recent')}</th>
                <th className="py-2 font-bold text-right">{rt('compare.change')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {compareRows.map((r) => {
                const c = r.change;
                const Icon = c ? deltaIcon(c.delta) : null;
                return (
                  <tr key={r.label}>
                    <td className="py-2.5 font-semibold text-slate-800">{r.label}</td>
                    <td className="py-2.5 text-slate-600">{c ? `${c.baseline}${r.unit}` : '--'}</td>
                    <td className="py-2.5 text-slate-900 font-bold">{c ? `${c.recent}${r.unit}` : '--'}</td>
                    <td className={cn('py-2.5 text-right font-bold', c ? DIR_COLOR[c.dir] : 'text-slate-400')}>
                      {c && Icon ? (
                        <span className="inline-flex items-center gap-1">
                          <Icon size={14} />
                          {signed(c.delta)}{r.signedUnit}
                        </span>
                      ) : (
                        <span className="font-medium text-xs">{rt('compare.notEnough')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Charts */}
        <section className="report-avoid-break mt-8">
          <h2 className="report-h2">{rt('trends.heading')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {charts.map((c) => (
              <div key={c.key} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-bold text-slate-600 mb-1">{c.title}</p>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="n" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={c.domain} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11 }}
                        labelFormatter={(_, p) => (p?.[0]?.payload?.label as string) ?? ''}
                      />
                      <Line
                        type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={2.2}
                        dot={{ r: 2.5, fill: c.color }} connectNulls isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Findings + recommendations */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <section className="report-avoid-break">
            <h2 className="report-h2">{rt('findings.heading')}</h2>
            <ul className="space-y-2 text-sm">
              {findings.map((f, i) => (
                <li key={i} className="flex gap-2 leading-snug">
                  {f.tone === 'good' && <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />}
                  {f.tone === 'warn' && <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />}
                  {f.tone === 'info' && <Info size={15} className="mt-0.5 shrink-0 text-slate-400" />}
                  <span className="text-slate-700">{f.text}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="report-avoid-break">
            <h2 className="report-h2">{rt('recs.heading')}</h2>
            <ul className="space-y-2 text-sm">
              {recommendations.map((text, i) => (
                <li key={i} className="flex gap-2 leading-snug">
                  <Lightbulb size={15} className="mt-0.5 shrink-0" style={{ color: accent }} />
                  <span className="text-slate-700">{text}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Session log */}
        <section className="mt-8">
          <h2 className="report-h2">{rt('log.heading')}</h2>
          <p className="text-xs text-slate-400 -mt-1 mb-2">{rt('log.showing', { count: recent.length })}</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase tracking-widest text-slate-400 border-b border-slate-200">
                {[
                  t('progress.history.headers.date'),
                  t('progress.history.headers.exercise'),
                  t('progress.history.headers.quality'),
                  t('progress.history.headers.pain'),
                  t('progress.history.headers.rom'),
                  rt('log.reps'),
                  t('progress.history.headers.duration'),
                ].map((h) => <th key={h} className="py-2 pr-2 font-bold text-[10px]">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((s) => (
                <tr key={s.id} className="report-avoid-break">
                  <td className="py-2 pr-2 text-slate-600 whitespace-nowrap">{fmtShort(s.date)}</td>
                  <td className="py-2 pr-2 font-semibold text-slate-800">{exerciseName(s.exerciseId, s.exerciseTitle)}</td>
                  <td className="py-2 pr-2">{s.quality > 0 ? `${Math.round(s.quality)}%` : '--'}</td>
                  <td className="py-2 pr-2">{s.painLevel}/10</td>
                  <td className="py-2 pr-2">{s.romDegrees > 0 ? `${Math.round(s.romDegrees)}°` : '--'}</td>
                  <td className="py-2 pr-2">{s.repCount}</td>
                  <td className="py-2 pr-2 whitespace-nowrap">{Math.round(s.duration / 60)} {t('common.min')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="report-avoid-break mt-8 pt-4 border-t border-slate-200 text-[11px] leading-relaxed text-slate-400">
          {rt('disclaimer')}
        </footer>
      </article>
    </div>,
    document.body,
  );
}
