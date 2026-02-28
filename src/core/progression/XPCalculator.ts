// XP and reward calculations for the progression system

/**
 * Returns the XP required to advance from the given level to the next.
 * Scales super-linearly so higher levels take progressively more effort.
 */
export function xpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export interface CombatAnswerStats {
  perfectCount: number;
  correctCount: number;
  partialCount: number;
  wrongCount: number;
}

const QUALITY_MULTIPLIERS = {
  perfect: 1.5,
  correct: 1.0,
  partial: 0.5,
  wrong: 0.25,
} as const;

/**
 * Calculates XP earned from a combat encounter.
 *
 * The quality multiplier is a weighted average across all answer qualities,
 * then the base XP is scaled by that multiplier and any active bonuses.
 */
export function calculateCombatXP(
  baseXP: number,
  stats: CombatAnswerStats,
  streakBonusPct: number,
  equipXpBonusPct: number,
  classXpBonusPct: number,
): number {
  const totalAnswers =
    stats.perfectCount + stats.correctCount + stats.partialCount + stats.wrongCount;

  if (totalAnswers === 0) {
    return 0;
  }

  const weightedSum =
    stats.perfectCount * QUALITY_MULTIPLIERS.perfect +
    stats.correctCount * QUALITY_MULTIPLIERS.correct +
    stats.partialCount * QUALITY_MULTIPLIERS.partial +
    stats.wrongCount * QUALITY_MULTIPLIERS.wrong;

  const qualityMultiplier = weightedSum / totalAnswers;
  const totalBonusPct = streakBonusPct + equipXpBonusPct + classXpBonusPct;

  return Math.floor(baseXP * qualityMultiplier * (1 + totalBonusPct / 100));
}

/**
 * Calculates gold earned from an encounter, applying any bonus percentage.
 */
export function calculateGoldReward(baseGold: number, goldBonusPct: number): number {
  return Math.floor(baseGold * (1 + goldBonusPct / 100));
}
