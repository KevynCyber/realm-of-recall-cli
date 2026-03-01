/**
 * Confidence wager system — risk/reward mechanic tied to metacognition.
 *
 * Before answering a combat card, the player can wager gold on their confidence.
 * Correct answers double the wager; wrong answers lose it.
 * This gamifies metacognitive accuracy — the optimal strategy is honest self-assessment.
 */

export type WagerLevel = "none" | "low" | "high" | "all_in";

export const WAGER_AMOUNTS: Record<WagerLevel, number> = {
  none: 0,
  low: 10,
  high: 25,
  all_in: 50,
};

export const WAGER_LABELS: Record<WagerLevel, string> = {
  none: "None",
  low: "Low (10g)",
  high: "High (25g)",
  all_in: "All-In (50g)",
};

export interface WagerResult {
  wager: WagerLevel;
  amount: number;
  isCorrect: boolean;
  goldDelta: number;
}

/**
 * Calculate the gold result of a wager.
 *
 * @param wager The wager level chosen by the player.
 * @param isCorrect Whether the player answered correctly.
 * @param playerGold The player's current gold (for capping all-in at actual gold).
 * @returns The wager result with gold delta.
 */
export function calculateWagerResult(
  wager: WagerLevel,
  isCorrect: boolean,
  playerGold: number = Infinity,
): WagerResult {
  const baseAmount = WAGER_AMOUNTS[wager];
  // Cap the actual wager at the player's available gold
  const amount = Math.min(baseAmount, Math.max(0, playerGold));

  if (amount === 0) {
    return { wager, amount: 0, isCorrect, goldDelta: 0 };
  }

  const goldDelta = isCorrect ? amount : -amount;
  return { wager, amount, isCorrect, goldDelta };
}

export interface SessionWagerSummary {
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  netGold: number;
  wagerCount: number;
}

/**
 * Summarize wager results for a combat session.
 */
export function summarizeWagers(results: WagerResult[]): SessionWagerSummary {
  let totalWagered = 0;
  let totalWon = 0;
  let totalLost = 0;
  let wagerCount = 0;

  for (const r of results) {
    if (r.amount === 0) continue;
    wagerCount++;
    totalWagered += r.amount;
    if (r.goldDelta > 0) {
      totalWon += r.goldDelta;
    } else {
      totalLost += Math.abs(r.goldDelta);
    }
  }

  return {
    totalWagered,
    totalWon,
    totalLost,
    netGold: totalWon - totalLost,
    wagerCount,
  };
}
