/**
 * MarginalGains analytics: pure functions for tracking incremental
 * improvements in recall accuracy, confidence calibration, and
 * study consistency.
 */

const SPARK_CHARS = "\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588"; // ▁▂▃▄▅▆▇█

/**
 * Generate a Unicode sparkline string from an array of numeric values.
 * Each value is mapped to one of eight block characters based on its
 * position within the min-max range of the array.
 */
export function generateSparkline(values: number[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return "\u2585"; // ▅

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) {
    // All values identical -- use middle character
    return values.map(() => SPARK_CHARS[4]).join("");
  }

  return values
    .map((v) => {
      const normalized = (v - min) / range; // 0..1
      const index = Math.min(
        SPARK_CHARS.length - 1,
        Math.floor(normalized * (SPARK_CHARS.length - 1)),
      );
      return SPARK_CHARS[index];
    })
    .join("");
}

export interface TrendResult {
  current: number;
  previous: number;
  percentChange: number;
  trend: "improving" | "stable" | "declining";
  sparkline: string;
}

/**
 * Calculate the trend from a series of values by comparing the average
 * of the most recent 7 values to the 7 before that.
 */
export function calculateTrend(
  values: number[],
  higherIsBetter: boolean,
): TrendResult {
  const recent = values.slice(-7);
  const previous = values.length > 7 ? values.slice(-14, -7) : [];

  const avg = (arr: number[]): number =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

  const current = avg(recent);
  const prev = previous.length > 0 ? avg(previous) : 0;

  const percentChange = prev === 0 ? (current === 0 ? 0 : 100) : ((current - prev) / Math.abs(prev)) * 100;

  let trend: "improving" | "stable" | "declining";
  if (Math.abs(percentChange) < 2) {
    trend = "stable";
  } else if (higherIsBetter) {
    trend = percentChange > 0 ? "improving" : "declining";
  } else {
    trend = percentChange < 0 ? "improving" : "declining";
  }

  return {
    current,
    previous: prev,
    percentChange,
    trend,
    sparkline: generateSparkline(values),
  };
}

/**
 * Calculate how well a player's confidence matches actual outcomes.
 * Returns a percentage (0-100).
 *
 * Match rules:
 *  - 'instant' + correct  = match
 *  - 'knew'    + correct  = match
 *  - 'guess'   + wrong    = match
 *  - 'guess'   + correct  = mismatch
 *  - 'instant'  + wrong   = mismatch
 */
export function calculateConfidenceCalibration(
  attempts: Array<{ correct: boolean; confidence: string }>,
): number {
  if (attempts.length === 0) return 0;

  let matches = 0;
  for (const a of attempts) {
    const isMatch =
      (a.confidence === "instant" && a.correct) ||
      (a.confidence === "knew" && a.correct) ||
      (a.confidence === "guess" && !a.correct);
    if (isMatch) matches++;
  }

  return (matches / attempts.length) * 100;
}

export interface MasteryProjection {
  daysToComplete: number;
  projectedIn30Days: number;
}

/**
 * Project how long it will take to master all cards, and how many
 * will be mastered in 30 days at the current rate.
 */
export function projectMastery(
  currentMastered: number,
  recentRate: number,
  totalCards: number,
): MasteryProjection {
  const remaining = totalCards - currentMastered;

  const daysToComplete =
    recentRate <= 0 ? -1 : Math.ceil(remaining / recentRate);

  const projectedIn30Days = Math.min(
    totalCards,
    currentMastered + recentRate * 30,
  );

  return { daysToComplete, projectedIn30Days };
}

/**
 * Render a 14-day consistency grid using filled/empty squares.
 * Index 0 = oldest day. Uses '\u25a0' (filled) for active and
 * '\u25a1' (empty) for inactive, space-separated.
 */
export function formatConsistencyGrid(activeDays: boolean[]): string {
  return activeDays.map((active) => (active ? "\u25a0" : "\u25a1")).join(" ");
}
