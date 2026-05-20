/**
 * Per-rehab-type clinical targets and milestones.
 *
 * The dashboard's Recovery % and Current Phase are derived from these targets
 * combined with the user's logged session history (see useRehabMetrics).
 */

import type { RehabType } from '../types';

export interface RehabTargets {
  /** Clinical range-of-motion goal in degrees that defines "full recovery" of mobility. */
  targetRom: number;
  /** Total prescribed sessions across the four phases. Drives the adherence half of Recovery %. */
  targetSessions: number;
  /**
   * Session-count thresholds (inclusive lower bound) for each rehab phase.
   * Index 0 = Phase 1 floor (always 0), index 1 = Phase 2 floor, etc.
   * A session count >= thresholds[3] puts the user in Phase 4.
   */
  phaseThresholds: [0, number, number, number];
}

export const REHAB_TARGETS: Record<RehabType, RehabTargets> = {
  knee:  { targetRom: 120, targetSessions: 48, phaseThresholds: [0, 6, 16, 31] },
  leg:   { targetRom:  90, targetSessions: 48, phaseThresholds: [0, 6, 16, 31] },
  elbow: { targetRom: 145, targetSessions: 48, phaseThresholds: [0, 6, 16, 31] },
};

export function phaseForSessionCount(type: RehabType, sessionCount: number): 1 | 2 | 3 | 4 {
  const [, p2, p3, p4] = REHAB_TARGETS[type].phaseThresholds;
  if (sessionCount >= p4) return 4;
  if (sessionCount >= p3) return 3;
  if (sessionCount >= p2) return 2;
  return 1;
}
