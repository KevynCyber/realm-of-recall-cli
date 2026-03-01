// Self-explanation prompts to deepen recall through elaborative interrogation

/** Probability of triggering an explanation prompt when conditions are met */
export const EXPLANATION_TRIGGER_RATE = 0.25;

/** Minimum consecutive correct answers before prompting for explanation */
export const MIN_CONSECUTIVE_CORRECT = 2;

/** Minimum character length for a valid explanation */
export const MIN_EXPLANATION_LENGTH = 10;

/** Wisdom XP bonus awarded for providing a valid explanation */
export const EXPLANATION_WXP_BONUS = 8;

/**
 * Card states eligible for self-explanation prompts.
 * Only well-practised cards (review/mastered) benefit from elaborative interrogation.
 */
const ELIGIBLE_STATES = new Set(["review", "mastered"]);

/**
 * Determine whether the player should be prompted to explain their answer.
 *
 * Conditions:
 * 1. Card must be in 'review' or 'mastered' state.
 * 2. Card must have at least MIN_CONSECUTIVE_CORRECT consecutive correct answers.
 * 3. A random roll must be below EXPLANATION_TRIGGER_RATE (25%).
 *
 * @param cardState  FSRS card state (new, learning, review, relearning, mastered)
 * @param consecutiveCorrect  Number of consecutive correct answers for this card
 * @param rng  Optional random number generator for deterministic testing
 */
export function shouldPromptExplanation(
  cardState: string,
  consecutiveCorrect: number,
  rng: () => number = Math.random,
): boolean {
  if (!ELIGIBLE_STATES.has(cardState)) {
    return false;
  }

  if (consecutiveCorrect < MIN_CONSECUTIVE_CORRECT) {
    return false;
  }

  return rng() < EXPLANATION_TRIGGER_RATE;
}

/**
 * Generate a contextual self-explanation prompt for the given card.
 *
 * @param cardFront  The question side of the card
 * @param cardBack   The answer side of the card
 * @returns A prompt asking the player to explain why the answer is correct
 */
export function generateExplanationPrompt(
  cardFront: string,
  cardBack: string,
): string {
  return `Why is '${cardBack}' the answer to '${cardFront}'? Explain in your own words.`;
}

/**
 * Validate that a player-supplied explanation meets minimum quality criteria.
 *
 * @param text  The player's explanation text
 * @returns true if the explanation is at least MIN_EXPLANATION_LENGTH characters
 *          after trimming and is not all whitespace
 */
export function isValidExplanation(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length >= MIN_EXPLANATION_LENGTH;
}
