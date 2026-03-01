/**
 * Pretesting effect — presenting new cards as a pretest before revealing the answer.
 *
 * Evidence: Richland et al. 2009, Latimier et al. 2023 — pretesting improves
 * subsequent retention by 10-30% even when pretest answers are wrong. The act
 * of attempting retrieval before learning primes the memory for encoding.
 *
 * When a card is new (no prior review), the learner attempts an answer first.
 * The attempt is recorded for analytics but does NOT affect FSRS scheduling.
 */

/**
 * Check if a card is eligible for pretesting.
 * Only truly new cards (never reviewed) get pretested.
 *
 * @param cardState The card's current FSRS state ('new', 'learning', 'review', etc.)
 * @param hasBeenPretested Whether this card has already been pretested this session
 */
export function isPretestEligible(
  cardState: string | null,
  hasBeenPretested: boolean = false,
): boolean {
  if (hasBeenPretested) return false;
  return cardState === null || cardState === "new";
}

/**
 * Generate the reveal message shown after a pretest attempt.
 *
 * @param correctAnswer The card's correct answer
 * @param wasCorrect Whether the pretest attempt was correct
 */
export function getPretestRevealMessage(
  correctAnswer: string,
  wasCorrect: boolean,
): string {
  if (wasCorrect) {
    return `Scout Report: Impressive! You already knew "${correctAnswer}".`;
  }
  return `Scout Report: The correct answer is "${correctAnswer}". This will help you remember it next time.`;
}

/** Flag value used to mark pretest attempts in recall_attempts. */
export const PRETEST_FLAG = "pretest";
