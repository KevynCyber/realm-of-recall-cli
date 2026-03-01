import type { Player } from "../../types/player.js";

export interface StreakUpdateResult {
  player: Player;
  message: string | null;
}

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
 * Calculate how many days to deduct from a streak on a missed day.
 * Formula: min(5, floor(streak / 4))
 * Returns 0 if streak is 0.
 */
export function calculateStreakDecay(currentStreak: number): number {
  if (currentStreak <= 0) return 0;
  return Math.min(5, Math.floor(currentStreak / 4));
}

/**
 * Calculate earn-back days: half the deducted days, rounded down, minimum 1.
 * Only applies when player missed exactly one day and comes back the next day.
 */
export function calculateEarnBack(decayAmount: number): number {
  if (decayAmount <= 0) return 0;
  return Math.max(1, Math.floor(decayAmount / 2));
}

/**
 * Pure function: given the current player state and today's date,
 * returns an updated player with the streak correctly tracked,
 * along with an optional message for UI display.
 *
 * Rules:
 *  - Same day review: no change.
 *  - First ever review (lastReviewDate is null): streak = 1.
 *  - Consecutive day (lastReviewDate === yesterday): increment streak.
 *  - Missed day with shield: consume one shield, treat as consecutive.
 *  - Missed day without shield: apply decay (deduct min(5, floor(streak/4)) days).
 *    If exactly one day was missed, earn-back recovers half the deducted days.
 *    If streak reaches 0 after decay, reset to 1 (today counts as a new start).
 */
export function updateStreak(player: Player, todayUTC: string): StreakUpdateResult {
  // Already studied today — nothing to update
  if (player.lastReviewDate === todayUTC) {
    return { player, message: null };
  }

  // First-ever review
  if (player.lastReviewDate === null) {
    return {
      player: {
        ...player,
        streakDays: 1,
        longestStreak: Math.max(player.longestStreak, 1),
        lastReviewDate: todayUTC,
      },
      message: null,
    };
  }

  const yesterday = getYesterday(todayUTC);

  // Consecutive day
  if (player.lastReviewDate === yesterday) {
    const newStreak = player.streakDays + 1;
    return {
      player: {
        ...player,
        streakDays: newStreak,
        longestStreak: Math.max(player.longestStreak, newStreak),
        lastReviewDate: todayUTC,
      },
      message: null,
    };
  }

  // Missed one or more days — try to use a shield
  if (player.shieldCount > 0) {
    const newStreak = player.streakDays + 1;
    return {
      player: {
        ...player,
        streakDays: newStreak,
        longestStreak: Math.max(player.longestStreak, newStreak),
        shieldCount: player.shieldCount - 1,
        lastReviewDate: todayUTC,
      },
      message: null,
    };
  }

  // Missed day(s) with no shields — apply decay instead of hard reset
  const oldStreak = player.streakDays;
  const decay = calculateStreakDecay(oldStreak);

  // Check if exactly one day was missed (lastReviewDate === day before yesterday)
  const dayBeforeYesterday = getYesterday(yesterday);
  const missedExactlyOneDay = player.lastReviewDate === dayBeforeYesterday;

  // Calculate earn-back if player missed exactly one day
  const earnBack = missedExactlyOneDay ? calculateEarnBack(decay) : 0;

  let newStreak = oldStreak - decay + earnBack;

  // Build the message
  let message: string | null;
  if (newStreak > 0) {
    message = `Streak reduced to ${newStreak} days (was ${oldStreak})`;
    // Increment by 1 for today's review
    newStreak += 1;
  } else {
    // Streak fully decayed — start fresh
    newStreak = 1;
    message = "Streak lost";
  }

  return {
    player: {
      ...player,
      streakDays: newStreak,
      longestStreak: Math.max(player.longestStreak, oldStreak),
      lastReviewDate: todayUTC,
    },
    message,
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
