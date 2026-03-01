// Three-correct learning gate: cards must be answered correctly N times
// in a row before graduating from the "learning" state.

/** Number of consecutive correct answers required to complete learning. */
export const DEFAULT_LEARNING_THRESHOLD = 3;

/** Session-level cap — warn the user when a single card has been drilled too many times. */
export const OVERLEARNING_THRESHOLD = 5;

/** Displayed when overlearning is detected. */
export const OVERLEARNING_MESSAGE =
  "This card is battle-ready. Spacing will help more than drilling now.";

/**
 * Has the card met the learning threshold?
 */
export function isLearningComplete(
  consecutiveCorrect: number,
  threshold: number = DEFAULT_LEARNING_THRESHOLD,
): boolean {
  return consecutiveCorrect >= threshold;
}

/**
 * Should the card be re-queued in the current session?
 *
 * Only cards in the `"learning"` state are eligible for re-queuing.
 * Cards in `"review"`, `"mastered"`, `"new"`, or `"relearning"` states
 * are never re-queued by the learning gate.
 */
export function shouldRequeueCard(
  cardState: string,
  consecutiveCorrect: number,
  threshold: number = DEFAULT_LEARNING_THRESHOLD,
): boolean {
  if (cardState !== "learning") {
    return false;
  }
  return !isLearningComplete(consecutiveCorrect, threshold);
}

/**
 * Build a progress snapshot for display purposes.
 */
export function getLearningProgress(
  consecutiveCorrect: number,
  threshold: number = DEFAULT_LEARNING_THRESHOLD,
): { current: number; required: number; complete: boolean } {
  return {
    current: consecutiveCorrect,
    required: threshold,
    complete: isLearningComplete(consecutiveCorrect, threshold),
  };
}

/**
 * Has the card been drilled too many times this session?
 */
export function isOverlearning(correctInSession: number): boolean {
  return correctInSession >= OVERLEARNING_THRESHOLD;
}
