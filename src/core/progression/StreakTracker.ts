import type { Player } from "../../types/player.js";

/**
 * Subtract one day from a YYYY-MM-DD date string.
 */
export function getYesterday(todayUTC: string): string {
  const [year, month, day] = todayUTC.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Pure function: given the current player state and today's date,
 * returns an updated player with the streak correctly tracked.
 *
 * Rules:
 *  - Same day review: no change.
 *  - First ever review (lastReviewDate is null): streak = 1.
 *  - Consecutive day (lastReviewDate === yesterday): increment streak.
 *  - Missed day with shield: consume one shield, treat as consecutive.
 *  - Missed day without shield: reset streak to 1.
 */
export function updateStreak(player: Player, todayUTC: string): Player {
  // Already studied today — nothing to update
  if (player.lastReviewDate === todayUTC) {
    return player;
  }

  // First-ever review
  if (player.lastReviewDate === null) {
    return {
      ...player,
      streakDays: 1,
      longestStreak: Math.max(player.longestStreak, 1),
      lastReviewDate: todayUTC,
    };
  }

  const yesterday = getYesterday(todayUTC);

  // Consecutive day
  if (player.lastReviewDate === yesterday) {
    const newStreak = player.streakDays + 1;
    return {
      ...player,
      streakDays: newStreak,
      longestStreak: Math.max(player.longestStreak, newStreak),
      lastReviewDate: todayUTC,
    };
  }

  // Missed one or more days — try to use a shield
  if (player.shieldCount > 0) {
    const newStreak = player.streakDays + 1;
    return {
      ...player,
      streakDays: newStreak,
      longestStreak: Math.max(player.longestStreak, newStreak),
      shieldCount: player.shieldCount - 1,
      lastReviewDate: todayUTC,
    };
  }

  // Missed day(s) with no shields — reset
  return {
    ...player,
    streakDays: 1,
    longestStreak: Math.max(player.longestStreak, player.streakDays),
    lastReviewDate: todayUTC,
  };
}

/**
 * Returns the XP bonus percentage for the given streak length.
 *
 *  0-2  days:  0%
 *  3-6  days: 10%
 *  7-13 days: 20%
 * 14-29 days: 30%
 * 30+  days: 50%
 */
export function getStreakBonus(streakDays: number): number {
  if (streakDays >= 30) return 50;
  if (streakDays >= 14) return 30;
  if (streakDays >= 7) return 20;
  if (streakDays >= 3) return 10;
  return 0;
}

/**
 * Returns true when the player has not yet studied today and their
 * streak is therefore at risk of being broken.
 */
export function isStreakAtRisk(player: Player, todayUTC: string): boolean {
  return player.lastReviewDate !== todayUTC;
}

/**
 * Returns a flavour title based on the current streak length.
 *
 *   0:    'Newcomer'
 *   7+:   'Dedicated'
 *  14+:   'Committed'
 *  30+:   'Master'
 * 100+:   'Legend'
 */
export function getStreakTitle(streakDays: number): string {
  if (streakDays >= 100) return "Legend";
  if (streakDays >= 30) return "Master";
  if (streakDays >= 14) return "Committed";
  if (streakDays >= 7) return "Dedicated";
  return "Newcomer";
}
