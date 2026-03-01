/**
 * Session length guardrails — pure logic for break suggestions.
 *
 * Research shows attention degrades after ~25 minutes.
 * Microlearning sessions of 5-15 minutes produce 4x higher engagement.
 */

/** Thresholds in milliseconds */
export const SOFT_BREAK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
export const HARD_BREAK_THRESHOLD_MS = 25 * 60 * 1000; // 25 minutes

export type BreakLevel = "none" | "soft" | "hard";

/**
 * Determine what level of break suggestion to show based on elapsed time.
 */
export function getBreakLevel(sessionStartMs: number, nowMs: number): BreakLevel {
  const elapsed = nowMs - sessionStartMs;
  if (elapsed >= HARD_BREAK_THRESHOLD_MS) return "hard";
  if (elapsed >= SOFT_BREAK_THRESHOLD_MS) return "soft";
  return "none";
}

/**
 * Format elapsed milliseconds as "Xm Ys" string.
 */
export function formatSessionDuration(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/**
 * Pick a friendly break message based on the break level.
 */
export function getBreakMessage(level: BreakLevel): string {
  switch (level) {
    case "soft":
      return "Consider taking a break soon — short sessions boost retention!";
    case "hard":
      return "You've been studying for a while. A break now will help your brain consolidate what you've learned.";
    case "none":
      return "";
  }
}

/**
 * Whether break suggestions should be suppressed (via env var).
 */
export function isBreakSuppressed(): boolean {
  return process.env.REALM_NO_ANIMATION === "1" || process.env.REALM_NO_ANIMATION === "true";
}
