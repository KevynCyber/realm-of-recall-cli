// CardEvolution — tier progression and health tracking for flashcards

export type EvolutionTier = 0 | 1 | 2 | 3;

export type CardHealthStatus = "healthy" | "struggling" | "leech";

/**
 * Evaluates the evolution tier a card should be at, given its performance metrics.
 *
 * Promotion rules:
 *   0→1: 3 consecutive correct AND state !== 'new'
 *   1→2: 3 consecutive correct at Good+ AND stability >= 10
 *   2→3: 3 consecutive correct at Good+ AND stability >= 30 AND lapsesSinceTier === 0
 *
 * Tiers never decrease — if currentTier is higher than what would be computed,
 * currentTier is returned.
 */
export function evaluateEvolutionTier(
  consecutiveCorrect: number,
  currentTier: EvolutionTier,
  fsrsState: string,
  stability: number,
  lapsesSinceTier: number,
): EvolutionTier {
  let computed: EvolutionTier = 0;

  // Check tier 1 requirements: 3 consecutive correct AND not new
  if (consecutiveCorrect >= 3 && fsrsState !== "new") {
    computed = 1;
  }

  // Check tier 2 requirements: tier 1 reqs + stability >= 10
  if (computed >= 1 && consecutiveCorrect >= 3 && stability >= 10) {
    computed = 2;
  }

  // Check tier 3 requirements: tier 2 reqs + stability >= 30 + no lapses since tier
  if (computed >= 2 && consecutiveCorrect >= 3 && stability >= 30 && lapsesSinceTier === 0) {
    computed = 3;
  }

  // Tiers never decrease
  return Math.max(computed, currentTier) as EvolutionTier;
}

/**
 * Determines the health status of a card based on recent answer quality and lapse count.
 *
 *   - 'leech' if totalLapses >= 5
 *   - 'struggling' if 3+ of the last 5 answers are 'wrong' or 'timeout'
 *   - 'healthy' otherwise
 */
export function getCardHealth(
  recentQualities: string[],
  totalLapses: number,
): CardHealthStatus {
  if (totalLapses >= 5) return "leech";

  const lastFive = recentQualities.slice(-5);
  const failCount = lastFive.filter((q) => q === "wrong" || q === "timeout").length;

  if (failCount >= 3) return "struggling";

  return "healthy";
}

/**
 * Returns the damage multiplier granted by a card's evolution tier.
 */
export function getTierDamageMultiplier(tier: EvolutionTier): number {
  const multipliers: Record<EvolutionTier, number> = {
    0: 1.0,
    1: 1.25,
    2: 1.5,
    3: 2.0,
  };
  return multipliers[tier];
}

/**
 * Returns the crit-chance bonus (percentage points) granted by a card's evolution tier.
 */
export function getTierCritBonus(tier: EvolutionTier): number {
  const bonuses: Record<EvolutionTier, number> = {
    0: 0,
    1: 0,
    2: 10,
    3: 25,
  };
  return bonuses[tier];
}

/**
 * Returns visual styling metadata for rendering a card at a given evolution tier.
 */
export function getTierVisual(
  tier: EvolutionTier,
): { borderStyle: string; borderColor: string; stars: number } {
  const visuals: Record<EvolutionTier, { borderStyle: string; borderColor: string; stars: number }> = {
    0: { borderStyle: "round", borderColor: "cyan", stars: 0 },
    1: { borderStyle: "round", borderColor: "cyan", stars: 1 },
    2: { borderStyle: "double", borderColor: "yellow", stars: 2 },
    3: { borderStyle: "double", borderColor: "magenta", stars: 3 },
  };
  return visuals[tier];
}
