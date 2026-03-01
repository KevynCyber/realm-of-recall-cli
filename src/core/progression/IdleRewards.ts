// Idle progression: gold and HP recovery while offline.
// Capped offline earnings create a gentle daily pull (Machinations.io).

/** Gold earned per hour while offline */
const GOLD_PER_HOUR = 30;

/** Maximum hours of offline gold accumulation */
const MAX_GOLD_HOURS = 8;

/** Maximum gold from offline progression (30 * 8 = 240) */
const MAX_IDLE_GOLD = GOLD_PER_HOUR * MAX_GOLD_HOURS;

/** HP recovered per hour as a fraction of maxHp */
const HP_RECOVERY_PER_HOUR = 0.1;

/** Maximum hours of HP recovery (capped at full HP anyway) */
const MAX_HP_HOURS = MAX_GOLD_HOURS;

/** Minimum hours away before idle rewards kick in */
const MIN_HOURS_AWAY = 1;

export interface IdleRewardResult {
  gold: number;
  hpRecovered: number;
  hoursAway: number;
}

/**
 * Calculate idle rewards based on time since last login.
 *
 * @param lastLoginAt ISO date string of last login, or null if never set
 * @param now Current date (defaults to new Date())
 * @param currentHp Player's current HP
 * @param maxHp Player's maximum HP
 * @returns Idle rewards (gold earned, HP recovered, hours away), or null if < 1 hour
 */
export function calculateIdleRewards(
  lastLoginAt: string | null,
  now: Date,
  currentHp: number,
  maxHp: number,
): IdleRewardResult | null {
  if (!lastLoginAt) return null;

  const lastLogin = new Date(lastLoginAt);
  const msAway = now.getTime() - lastLogin.getTime();
  const hoursAway = msAway / (1000 * 60 * 60);

  if (hoursAway < MIN_HOURS_AWAY) return null;

  // Gold: 30/hour, capped at 8 hours (240 max)
  const goldHours = Math.min(hoursAway, MAX_GOLD_HOURS);
  const gold = Math.floor(goldHours * GOLD_PER_HOUR);

  // HP: 10% maxHp/hour, capped at full
  const hpHours = Math.min(hoursAway, MAX_HP_HOURS);
  const hpRecoveryRaw = Math.floor(hpHours * HP_RECOVERY_PER_HOUR * maxHp);
  const hpMissing = maxHp - currentHp;
  const hpRecovered = Math.min(hpRecoveryRaw, Math.max(0, hpMissing));

  return {
    gold: Math.min(gold, MAX_IDLE_GOLD),
    hpRecovered,
    hoursAway: Math.floor(hoursAway),
  };
}
