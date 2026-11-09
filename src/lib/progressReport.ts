/**
 * Rule-based progress analysis for the printable patient report.
 *
 * Pure functions only — no model, no network. Takes the patient's logged
 * sessions, compares the start of the programme with the most recent sessions,
 * applies fixed thresholds, and returns structured facts. The report component
 * (components/ProgressReport.tsx) turns those facts into sentences through
 * i18n templates, so the narrative is available in English, Russian and Kazakh.
 *
 * This is "template-based natural language generation": data -> rules -> text.
 */

import type { SessionRecord } from './sessions';
import type { RehabMetrics } from '../hooks/useRehabMetrics';
import { REHAB_TARGETS } from './rehabConfig';
import type { RehabType } from '../types';

export type TrendDir = 'improved' | 'declined' | 'stable';
export type ReportStatus = 'early' | 'excellent' | 'good' | 'steady' | 'attention';

/** Start-of-programme vs. recent average for one metric. */
export interface MetricChange {
  baseline: number;
  recent: number;
  delta: number;
  dir: TrendDir;
}

export interface SeriesPoint {
  n: number;
  label: string;           // short date, filled in by the component
  date: Date;
  rom: number | null;
  quality: number | null;
  pain: number;
}

export interface ReportFlags {
  painHigh: boolean;
  qualityLow: boolean;
  romLow: boolean;
  adherenceLow: boolean;
  inactive: boolean;
}

export interface ProgressReportData {
  sessionCount: number;
  firstDate: Date;
  lastDate: Date;
  periodWeeks: number;
  totalMinutes: number;
  totalReps: number;
  totalSets: number;
  sessionsPerWeek: number;
  adherencePct: number;
  daysSinceLast: number;

  /** Number of sessions averaged at each end of the comparison. */
  windowSize: number;
  rom: MetricChange | null;
  quality: MetricChange | null;
  pain: MetricChange | null;

  avgQuality: number | null;
  avgPain: number;
  bestRom: number | null;
  latestPain: number;
  romPctOfTarget: number | null;
  targetRom: number;

  bestSession: SessionRecord | null;
  topExercise: { id: string; title: string; count: number };

  phase: 1 | 2 | 3 | 4;
  recoveryPct: number;
  /** Sessions still needed to reach the next phase, or null in the final phase. */
  sessionsToNextPhase: number | null;

  status: ReportStatus;
  flags: ReportFlags;
  /** Chronological (oldest -> newest), capped to the latest 20 sessions. */
  series: SeriesPoint[];
}

// ── thresholds ───────────────────────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const ROM_STEP = 3;            // degrees that count as a real change
const QUALITY_STEP = 3;        // score points that count as a real change
const PAIN_STEP = 0.5;         // pain points that count as a real change
const PAIN_HIGH = 7;           // single-session pain that triggers a warning
const PAIN_HIGH_AVG = 6;       // average of the last 3 sessions that triggers a warning
const QUALITY_LOW = 65;
const ROM_LOW_PCT = 60;
const MIN_SESSIONS_PER_WEEK = 3;
const INACTIVE_DAYS = 7;
const MIN_SESSIONS_FOR_TRENDS = 3;
const SERIES_LIMIT = 20;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Compare the first `k` values with the last `k` values of a chronological
 * series. `higherIsBetter` flips the direction for pain.
 */
function compare(
  values: number[],
  step: number,
  higherIsBetter: boolean,
  decimals: 0 | 1,
): { change: MetricChange | null; k: number } {
  if (values.length < 2) return { change: null, k: 0 };
  const k = Math.min(3, Math.floor(values.length / 2));
  const fmt = (n: number) => (decimals === 0 ? Math.round(n) : round1(n));
  const baseline = mean(values.slice(0, k));
  const recent = mean(values.slice(-k));
  const rawDelta = recent - baseline;
  let dir: TrendDir = 'stable';
  if (Math.abs(rawDelta) >= step) {
    const up = rawDelta > 0;
    dir = up === higherIsBetter ? 'improved' : 'declined';
  }
  return {
    change: { baseline: fmt(baseline), recent: fmt(recent), delta: fmt(rawDelta), dir },
    k,
  };
}

export function buildProgressReport(
  rehabType: RehabType,
  sessionsNewestFirst: SessionRecord[],
  metrics: RehabMetrics,
  now: Date = new Date(),
): ProgressReportData | null {
  if (sessionsNewestFirst.length === 0) return null;

  const sessions = [...sessionsNewestFirst].sort((a, b) => a.date.getTime() - b.date.getTime());
  const n = sessions.length;
  const first = sessions[0];
  const last = sessions[n - 1];
  const targets = REHAB_TARGETS[rehabType];

  // A ROM or quality of 0 means "not measured" (offline ML / no camera data),
  // so those sessions are left out of the averages instead of dragging them down.
  const romValues = sessions.filter((s) => s.romDegrees > 0).map((s) => s.romDegrees);
  const qualityValues = sessions.filter((s) => s.quality > 0).map((s) => s.quality);
  const painValues = sessions.map((s) => s.painLevel);

  const romCmp = compare(romValues, ROM_STEP, true, 0);
  const qualityCmp = compare(qualityValues, QUALITY_STEP, true, 0);
  const painCmp = compare(painValues, PAIN_STEP, false, 1);
  const windowSize = Math.max(romCmp.k, qualityCmp.k, painCmp.k);

  const periodWeeks = Math.max(1, Math.ceil((last.date.getTime() - first.date.getTime()) / WEEK_MS));
  const sessionsPerWeek = round1(n / periodWeeks);
  const adherencePct = Math.min(100, Math.round((n / targets.targetSessions) * 100));
  const daysSinceLast = Math.max(0, Math.floor((now.getTime() - last.date.getTime()) / DAY_MS));

  const bestRom = romValues.length ? Math.max(...romValues) : null;
  const romPctOfTarget = bestRom !== null ? Math.round((bestRom / targets.targetRom) * 100) : null;
  const avgQuality = qualityValues.length ? Math.round(mean(qualityValues)) : null;
  const avgPain = round1(mean(painValues));
  const latestPain = last.painLevel;
  const lastThreePain = mean(painValues.slice(-3));

  const scored = sessions.filter((s) => s.quality > 0);
  const bestSession = scored.length
    ? scored.reduce((best, s) => (s.quality > best.quality ? s : best))
    : null;

  const counts = new Map<string, { id: string; title: string; count: number }>();
  for (const s of sessions) {
    const entry = counts.get(s.exerciseId) ?? { id: s.exerciseId, title: s.exerciseTitle, count: 0 };
    entry.count += 1;
    counts.set(s.exerciseId, entry);
  }
  const topExercise = [...counts.values()].sort((a, b) => b.count - a.count)[0];

  // phaseThresholds[i] is the floor of phase i+1, so index = current phase gives the next floor.
  const sessionsToNextPhase =
    metrics.currentPhase < 4
      ? Math.max(0, targets.phaseThresholds[metrics.currentPhase as 1 | 2 | 3] - n)
      : null;

  // ── recent-quality / flags ─────────────────────────────────────────────────
  const recentQuality = qualityCmp.change?.recent ?? avgQuality;
  const flags: ReportFlags = {
    painHigh: latestPain >= PAIN_HIGH || lastThreePain >= PAIN_HIGH_AVG,
    qualityLow: recentQuality !== null && recentQuality < QUALITY_LOW,
    romLow: n >= MIN_SESSIONS_FOR_TRENDS && romPctOfTarget !== null && romPctOfTarget < ROM_LOW_PCT,
    adherenceLow: n >= MIN_SESSIONS_FOR_TRENDS && sessionsPerWeek < MIN_SESSIONS_PER_WEEK,
    inactive: daysSinceLast > INACTIVE_DAYS,
  };

  // ── overall status ─────────────────────────────────────────────────────────
  const changes = [romCmp.change, qualityCmp.change, painCmp.change];
  const improved = changes.filter((c) => c?.dir === 'improved').length;
  const declined = changes.filter((c) => c?.dir === 'declined').length;
  let status: ReportStatus;
  if (n < MIN_SESSIONS_FOR_TRENDS) status = 'early';
  else if (flags.painHigh || declined > 0) status = 'attention';
  else if (improved >= 2) status = 'excellent';
  else if (improved === 1) status = 'good';
  else status = 'steady';

  const series: SeriesPoint[] = sessions.slice(-SERIES_LIMIT).map((s, i) => ({
    n: i + 1,
    label: '',
    date: s.date,
    rom: s.romDegrees > 0 ? Math.round(s.romDegrees) : null,
    quality: s.quality > 0 ? Math.round(s.quality) : null,
    pain: s.painLevel,
  }));

  return {
    sessionCount: n,
    firstDate: first.date,
    lastDate: last.date,
    periodWeeks,
    totalMinutes: Math.round(sessions.reduce((a, s) => a + s.duration, 0) / 60),
    totalReps: sessions.reduce((a, s) => a + s.repCount, 0),
    totalSets: sessions.reduce((a, s) => a + s.setsCompleted, 0),
    sessionsPerWeek,
    adherencePct,
    daysSinceLast,
    windowSize,
    rom: romCmp.change,
    quality: qualityCmp.change,
    pain: painCmp.change,
    avgQuality,
    avgPain,
    bestRom: bestRom !== null ? Math.round(bestRom) : null,
    latestPain,
    romPctOfTarget,
    targetRom: targets.targetRom,
    bestSession,
    topExercise,
    phase: metrics.currentPhase,
    recoveryPct: metrics.recoveryPct,
    sessionsToNextPhase,
    status,
    flags,
    series,
  };
}

/** Format a signed delta for the narrative ("+5", "-3", "0"). */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}
