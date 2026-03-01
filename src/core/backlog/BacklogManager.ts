/**
 * BacklogManager — pure functions for backlog detection and session sizing.
 *
 * When a learner returns after days away, facing hundreds of overdue cards
 * causes most SRS users to quit. This module provides gentle re-engagement
 * by detecting large backlogs and offering manageable session sizes.
 */

/** Threshold: show WelcomeBack flow when overdue count exceeds this */
export const BACKLOG_THRESHOLD = 50;

export type BacklogSessionOption = "quick" | "normal" | "full";

export interface BacklogInfo {
  overdueCount: number;
  daysSinceLastReview: number;
  shouldShowWelcomeBack: boolean;
}

/**
 * Compute backlog information from overdue count and last review timestamp.
 *
 * @param overdueCount - Number of overdue (non-new) cards
 * @param lastReviewTimestampMs - Timestamp in ms of the most recent review, or null if never reviewed
 * @param nowMs - Current time in ms (default: Date.now())
 */
export function getBacklogInfo(
  overdueCount: number,
  lastReviewTimestampMs: number | null,
  nowMs: number = Date.now(),
): BacklogInfo {
  let daysSinceLastReview = 0;

  if (lastReviewTimestampMs !== null) {
    const diffMs = nowMs - lastReviewTimestampMs;
    daysSinceLastReview = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  return {
    overdueCount,
    daysSinceLastReview,
    shouldShowWelcomeBack: overdueCount > BACKLOG_THRESHOLD,
  };
}

/**
 * Get the card IDs for a backlog session option.
 * Cards are assumed to already be sorted by stability DESC (highest first)
 * from the repository query.
 *
 * @param option - Session option chosen by the player
 * @param overdueCardIds - All overdue card IDs, pre-sorted by stability DESC
 * @returns Subset of card IDs for the chosen session
 */
export function getBacklogSessionCardIds(
  option: BacklogSessionOption,
  overdueCardIds: string[],
): string[] {
  switch (option) {
    case "quick":
      return overdueCardIds.slice(0, 10);
    case "normal":
      return overdueCardIds.slice(0, 20);
    case "full":
      return [...overdueCardIds];
  }
}

/**
 * Get a friendly welcome-back message based on days away and overdue count.
 */
export function getWelcomeBackMessage(
  daysSinceLastReview: number,
  overdueCount: number,
): string {
  if (daysSinceLastReview <= 1) {
    return `Welcome back! You have ${overdueCount} cards waiting for review.`;
  }
  if (daysSinceLastReview <= 7) {
    return `Welcome back! It's been ${daysSinceLastReview} days. You have ${overdueCount} overdue cards — no worries, let's ease back in.`;
  }
  if (daysSinceLastReview <= 30) {
    return `Welcome back after ${daysSinceLastReview} days! You have ${overdueCount} overdue cards. The best time to restart is now.`;
  }
  return `Welcome back after ${daysSinceLastReview} days away! You have ${overdueCount} overdue cards. Every expert was once a beginner — let's pick up where you left off.`;
}
