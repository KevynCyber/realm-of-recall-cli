/**
 * Oracle's Trial — metacognitive calibration challenge.
 *
 * Periodically, the Oracle challenges the player to predict how many cards
 * they'll answer correctly in an upcoming review. Accurate self-assessment
 * earns bonus WXP, rewarding calibration over raw performance.
 */

// --- Constants ---

/** Sessions between guaranteed trial triggers */
export const TRIAL_SESSION_INTERVAL = 5;

/** Probability of a random trial trigger between intervals */
export const TRIAL_RANDOM_CHANCE = 0.10;

/** Minimum sessions since last trial before random trigger is eligible */
export const MIN_SESSIONS_SINCE_TRIAL = 3;

/** Max prediction error for "seer" tier */
export const SEER_THRESHOLD = 1;

/** Max prediction error for "adept" tier */
export const ADEPT_THRESHOLD = 2;

/** WXP multiplier for seer tier (difference <= 1) */
export const SEER_MULTIPLIER = 2.0;

/** WXP multiplier for adept tier (difference <= 2) */
export const ADEPT_MULTIPLIER = 1.5;

/** Base WXP awarded for completing a trial */
export const BASE_TRIAL_WXP = 10;

// --- Interfaces ---

export interface OracleTrialSetup {
  cardCount: number;
  prompt: string;
}

export interface OracleTrialResult {
  predicted: number;
  actual: number;
  difference: number;
  tier: "seer" | "adept" | "novice";
  wxpMultiplier: number;
  message: string;
}

// --- Functions ---

/**
 * Determine whether an Oracle's Trial should trigger this session.
 *
 * Triggers if:
 * 1. sessionsCompleted is a multiple of TRIAL_SESSION_INTERVAL (and > 0), OR
 * 2. Random chance (TRIAL_RANDOM_CHANCE) if at least MIN_SESSIONS_SINCE_TRIAL
 *    sessions have passed since the last trial.
 *
 * Never triggers if lastTrialSession === sessionsCompleted (already done this session).
 */
export function shouldTriggerOracleTrial(
  sessionsCompleted: number,
  lastTrialSession: number,
  rng: () => number = Math.random,
): boolean {
  // Never trigger twice in the same session
  if (lastTrialSession === sessionsCompleted) {
    return false;
  }

  // Guaranteed trigger at interval
  if (sessionsCompleted > 0 && sessionsCompleted % TRIAL_SESSION_INTERVAL === 0) {
    return true;
  }

  // Random trigger if enough sessions have elapsed since last trial
  const sessionsSinceLastTrial = sessionsCompleted - lastTrialSession;
  if (sessionsSinceLastTrial >= MIN_SESSIONS_SINCE_TRIAL) {
    return rng() < TRIAL_RANDOM_CHANCE;
  }

  return false;
}

/**
 * Create the setup for an Oracle's Trial.
 */
export function createOracleTrial(cardCount: number): OracleTrialSetup {
  return {
    cardCount,
    prompt: `Oracle's Trial: You will review ${cardCount} cards. How many will you answer correctly?`,
  };
}

/**
 * Score an Oracle's Trial based on prediction accuracy.
 *
 * Tiers:
 * - "seer":   difference <= 1 -> 2.0x WXP
 * - "adept":  difference <= 2 -> 1.5x WXP
 * - "novice": difference > 2  -> 1.0x WXP (no bonus)
 */
export function scoreOracleTrial(
  predicted: number,
  actual: number,
  cardCount: number,
): OracleTrialResult {
  const difference = Math.abs(predicted - actual);

  let tier: OracleTrialResult["tier"];
  let wxpMultiplier: number;
  let message: string;

  if (difference <= SEER_THRESHOLD) {
    tier = "seer";
    wxpMultiplier = SEER_MULTIPLIER;
    message =
      difference === 0
        ? "Perfect calibration! The Oracle is impressed by your self-knowledge."
        : "Near-perfect calibration! You know your own mind well.";
  } else if (difference <= ADEPT_THRESHOLD) {
    tier = "adept";
    wxpMultiplier = ADEPT_MULTIPLIER;
    message = "Good calibration. Your self-assessment grows stronger.";
  } else {
    tier = "novice";
    wxpMultiplier = 1.0;
    message = "The Oracle suggests more honest self-reflection. Know thyself!";
  }

  return {
    predicted,
    actual,
    difference,
    tier,
    wxpMultiplier,
    message,
  };
}
