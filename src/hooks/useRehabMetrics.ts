/**
 * Derives all dashboard / progress metrics from a session history.
 *
 * Pure function wrapped in `useMemo` — no Firestore reads here, just shaping
 * raw `SessionRecord[]` into the numbers the dashboard renders.
 *
 * Recovery % composite (per the product decision):
 *   recovery = (romRatio + sessionRatio) / 2 × 100
 *   romRatio     = min(latestRomDegrees / targetRom, 1)
 *   sessionRatio = min(sessionCount / targetSessions, 1)
 *
 * Phase is session-count driven — see rehabConfig.phaseForSessionCount.
 *
 * The weekly chart bins sessions into eight weekly buckets ending today.
 * Each week reports the BEST ROM achieved (peak performance, not average),
 * the average form-quality score, and the average reported pain. Empty
 * weeks render as null so recharts draws a gap instead of a misleading 0.
 */

import { useMemo } from 'react';
import type { SessionRecord } from '../lib/sessions';
import { phaseForSessionCount, REHAB_TARGETS } from '../lib/rehabConfig';
import type { RehabType } from '../types';

export interface WeeklyPoint {
  week: string;
  rom: number | null;      // peak ROM in degrees; null = no sessions that week
  quality: number | null;  // avg form quality 0-100
  pain: number | null;     // avg reported pain 0-10
}

export interface RehabMetrics {
  sessionCount: number;
  currentPhase: 1 | 2 | 3 | 4;
  /** 0-100 composite recovery. Always 0 with zero sessions. */
  recoveryPct: number;
  /** Δ recovery vs. one week ago, percentage points. */
  recoveryTrend: number;
  /** Peak ROM (deg) from the latest session, or null if none. */
  latestRomDegrees: number | null;
  /** Δ peak ROM (deg) between this week and last week. */
  romTrend: number;
  /** Pain level from the most recent session, or null if none. */
  latestPainLevel: number | null;
  /** 8-week chart series, oldest → newest, length always 8. */
  weeklySeries: WeeklyPoint[];
  /** True when the user has zero sessions for this rehab type. */
  isEmpty: boolean;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Composite recovery score for an arbitrary point in time, given the sessions
 * that existed up to that point. Used both for the live value and the
 * week-ago value (so we can show a trend).
 */
function recoveryFor(
  type: RehabType,
  sessions: SessionRecord[],
): number {
  if (sessions.length === 0) return 0;
  const { targetRom, targetSessions } = REHAB_TARGETS[type];
  const latestRom = sessions[0].romDegrees;
  const romRatio = Math.min(latestRom / targetRom, 1);
  const sessionRatio = Math.min(sessions.length / targetSessions, 1);
  return Math.round(((romRatio + sessionRatio) / 2) * 100);
}

export function useRehabMetrics(rehabType: RehabType, sessions: SessionRecord[]): RehabMetrics {
  return useMemo(() => {
    // Sessions arrive newest-first; we rely on that ordering for "latest" reads.
    const sessionCount = sessions.length;
    const currentPhase = phaseForSessionCount(rehabType, sessionCount);
    const recoveryPct = recoveryFor(rehabType, sessions);

    // For the trend, compute what recovery would have been one week ago.
    const oneWeekAgo = Date.now() - WEEK_MS;
    const sessionsAWeekAgo = sessions.filter((s) => s.date.getTime() <= oneWeekAgo);
    const recoveryAWeekAgo = recoveryFor(rehabType, sessionsAWeekAgo);
    const recoveryTrend = recoveryPct - recoveryAWeekAgo;

    const latestRomDegrees = sessions[0]?.romDegrees ?? null;
    const latestPainLevel  = sessions[0]?.painLevel  ?? null;

    // ── Build 8-week series ending today ──────────────────────────────────────
    // Week buckets are anchored to "today" so the rightmost point is always
    // the current week. Bucket i covers [today-i*7d, today-(i-1)*7d).
    const today = startOfDay(new Date());
    const weekStarts: Date[] = [];
    for (let i = 7; i >= 0; i--) {
      weekStarts.push(new Date(today.getTime() - i * WEEK_MS));
    }
    const weeklySeries: WeeklyPoint[] = weekStarts.map((start, i) => {
      const end = i === weekStarts.length - 1
        ? new Date(today.getTime() + WEEK_MS)            // current week reaches into the future
        : weekStarts[i + 1];
      const inWeek = sessions.filter((s) => s.date >= start && s.date < end);
      if (inWeek.length === 0) {
        return { week: `W${i + 1}`, rom: null, quality: null, pain: null };
      }
      const peakRom = Math.max(...inWeek.map((s) => s.romDegrees));
      const avgQuality = inWeek.reduce((a, s) => a + s.quality, 0) / inWeek.length;
      const avgPain    = inWeek.reduce((a, s) => a + s.painLevel, 0) / inWeek.length;
      return {
        week: `W${i + 1}`,
        rom: Math.round(peakRom),
        quality: Math.round(avgQuality),
        pain: Math.round(avgPain * 10) / 10,
      };
    });

    // ROM trend = this week's peak − previous week's peak (both relative to the
    // weekly buckets above). Falls back to 0 if either side is null.
    const thisWeek = weeklySeries[weeklySeries.length - 1].rom;
    const prevWeek = weeklySeries[weeklySeries.length - 2].rom;
    const romTrend = (thisWeek != null && prevWeek != null) ? thisWeek - prevWeek : 0;

    return {
      sessionCount,
      currentPhase,
      recoveryPct,
      recoveryTrend,
      latestRomDegrees,
      romTrend,
      latestPainLevel,
      weeklySeries,
      isEmpty: sessionCount === 0,
    };
  }, [rehabType, sessions]);
}
