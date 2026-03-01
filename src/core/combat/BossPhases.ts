// Multi-phase boss encounters — US-039

import { EnemyTier } from "../../types/combat.js";

export interface BossPhase {
  name: string;
  hpThreshold: number; // percentage (0-1) of HP where this phase starts
  description: string;
  damageMultiplier: number; // applied to enemy attacks
  xpMultiplier: number; // bonus XP for correct answers during this phase
  hintsDisabled: boolean;
  timerReduction: number; // seconds subtracted from timer (0 = no change)
}

// Phase HP thresholds
export const PHASE_1_THRESHOLD = 1.0;
export const PHASE_2_THRESHOLD = 0.6;
export const PHASE_3_THRESHOLD = 0.3;

/**
 * Return the three boss phases for a given enemy.
 * Phase ordering is from earliest (highest HP) to latest (lowest HP).
 */
export function getBossPhases(enemyName: string): BossPhase[] {
  return [
    {
      name: "Awakening",
      hpThreshold: PHASE_1_THRESHOLD,
      description: `${enemyName} enters the battlefield.`,
      damageMultiplier: 1.0,
      xpMultiplier: 1.0,
      hintsDisabled: false,
      timerReduction: 0,
    },
    {
      name: "Fury",
      hpThreshold: PHASE_2_THRESHOLD,
      description: `${enemyName} flies into a fury! Hints are no longer available.`,
      damageMultiplier: 1.5,
      xpMultiplier: 1.25,
      hintsDisabled: true,
      timerReduction: 0,
    },
    {
      name: "Enrage",
      hpThreshold: PHASE_3_THRESHOLD,
      description: `${enemyName} is enraged! Damage doubled, timer shortened.`,
      damageMultiplier: 2.0,
      xpMultiplier: 2.0,
      hintsDisabled: true,
      timerReduction: 5,
    },
  ];
}

/**
 * Given a list of phases and the boss's current HP percentage (0-1),
 * return the active phase.
 *
 * Walk phases from last (lowest threshold) to first, returning the
 * first phase whose threshold is strictly greater than currentHpPercent.
 */
export function getCurrentPhase(
  phases: BossPhase[],
  currentHpPercent: number,
): BossPhase {
  for (let i = phases.length - 1; i >= 0; i--) {
    if (currentHpPercent < phases[i].hpThreshold) {
      return phases[i];
    }
  }
  // If HP is at or above every threshold, return the first phase.
  return phases[0];
}

/**
 * Detect whether the boss transitioned to a new phase between two HP snapshots.
 */
export function hasPhaseChanged(
  phases: BossPhase[],
  previousHpPercent: number,
  currentHpPercent: number,
): { changed: boolean; newPhase: BossPhase | null } {
  const previousPhase = getCurrentPhase(phases, previousHpPercent);
  const currentPhase = getCurrentPhase(phases, currentHpPercent);

  if (previousPhase.name !== currentPhase.name) {
    return { changed: true, newPhase: currentPhase };
  }

  return { changed: false, newPhase: null };
}

/**
 * Returns true when the enemy tier qualifies for multi-phase encounters.
 */
export function isBossEnemy(enemyTier: string): boolean {
  return enemyTier === EnemyTier.Boss || enemyTier === EnemyTier.Elite;
}
