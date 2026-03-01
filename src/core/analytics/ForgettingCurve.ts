/**
 * Forgetting curve visualization analytics — pure functions for
 * predicting memory retention decay and quantifying the cost of
 * skipping review sessions.
 *
 * Uses the FSRS-style power-law decay model:
 *   R(t) = (1 + t / (9 * S))^(-1)
 * where S is stability (days) and t is elapsed time since last review.
 *
 * References: Piotr Wozniak's three-component model of memory,
 * FSRS v4 (Jarrett Ye, 2023).
 */

// ── Constants ──────────────────────────────────────────────────────

/** Retention at or above this level is considered healthy. */
export const HEALTHY_THRESHOLD = 0.7;

/** Retention below HEALTHY but at or above this level is at risk. */
export const AT_RISK_THRESHOLD = 0.4;

/** Denominator scaling factor in the FSRS power-law decay formula. */
export const FSRS_DECAY_FACTOR = 9;

// ── Core retention calculation ─────────────────────────────────────

/**
 * Calculate retrievability (retention probability) at a given elapsed
 * time using FSRS power-law decay.
 *
 * @param stability  Card stability in days (S). If <= 0, returns 0.
 * @param elapsedDays  Days since last review (t). If < 0, treated as 0.
 * @returns Retention probability in [0, 1].
 */
function calculateRetention(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  const t = Math.max(0, elapsedDays);
  return Math.pow(1 + t / (FSRS_DECAY_FACTOR * stability), -1);
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Produce a daily retention forecast starting from `daysSinceReview`
 * into the future.
 *
 * @param stability       Card stability (S).
 * @param daysSinceReview Days already elapsed since last review.
 * @param daysToForecast  Number of future days to predict.
 * @returns Array of length `daysToForecast`, each entry the predicted
 *          retention probability (0-1) for that day ahead.
 */
export function getRetentionForecast(
  stability: number,
  daysSinceReview: number,
  daysToForecast: number,
): number[] {
  const forecast: number[] = [];
  for (let day = 1; day <= daysToForecast; day++) {
    forecast.push(calculateRetention(stability, daysSinceReview + day));
  }
  return forecast;
}

/**
 * Classify a single retrievability value into a human-readable
 * retention category.
 */
export function categorizeRetention(
  retrievability: number,
): "healthy" | "at_risk" | "critical" {
  if (retrievability >= HEALTHY_THRESHOLD) return "healthy";
  if (retrievability >= AT_RISK_THRESHOLD) return "at_risk";
  return "critical";
}

export interface CardRetentionSummary {
  healthy: number;
  atRisk: number;
  critical: number;
}

/**
 * Categorize an array of cards by their current retention status
 * and return counts per category.
 *
 * Cards with no stability (0 or undefined) are treated as critical.
 */
export function getCardRetentionSummary(
  cards: Array<{ stability: number; daysSinceReview: number }>,
): CardRetentionSummary {
  const summary: CardRetentionSummary = { healthy: 0, atRisk: 0, critical: 0 };

  for (const card of cards) {
    const s = card.stability ?? 0;
    const retention = calculateRetention(s, card.daysSinceReview);
    const category = categorizeRetention(retention);

    if (category === "healthy") summary.healthy++;
    else if (category === "at_risk") summary.atRisk++;
    else summary.critical++;
  }

  return summary;
}

export interface SkipCostForecast {
  today: number;
  skip1: number;
  skip3: number;
  skip7: number;
}

/**
 * Show the retention cost of skipping review for 0, 1, 3, or 7 days.
 * Values are percentages (0-100).
 */
export function getSkipCostForecast(
  stability: number,
  daysSinceReview: number,
): SkipCostForecast {
  return {
    today: calculateRetention(stability, daysSinceReview) * 100,
    skip1: calculateRetention(stability, daysSinceReview + 1) * 100,
    skip3: calculateRetention(stability, daysSinceReview + 3) * 100,
    skip7: calculateRetention(stability, daysSinceReview + 7) * 100,
  };
}
