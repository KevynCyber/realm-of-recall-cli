import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FSRSCard,
  type Grade,
} from "ts-fsrs";
import { AnswerQuality, type ScheduleData } from "../../types/index.js";

/**
 * FSRS spaced repetition scheduler.
 *
 * Replaces the legacy SM-2 algorithm with the FSRS algorithm (ts-fsrs).
 * Maps our AnswerQuality enum to FSRS Rating values.
 */

const QUALITY_TO_RATING: Record<AnswerQuality, Grade> = {
  [AnswerQuality.Perfect]: Rating.Easy,
  [AnswerQuality.Correct]: Rating.Good,
  [AnswerQuality.Partial]: Rating.Hard,
  [AnswerQuality.Wrong]: Rating.Again,
  [AnswerQuality.Timeout]: Rating.Again,
};

const STATE_TO_STRING: Record<State, ScheduleData["state"]> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

const STRING_TO_STATE: Record<ScheduleData["state"], State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

// Module-level FSRS instance with fuzz enabled
const f = fsrs(generatorParameters({ enable_fuzz: true }));

export function createInitialSchedule(cardId: string): ScheduleData {
  const now = new Date();
  return {
    cardId,
    difficulty: 0,
    stability: 0,
    reps: 0,
    lapses: 0,
    state: "new",
    due: now.toISOString(),
    lastReview: now.toISOString(),
  };
}

export function updateSchedule(
  schedule: ScheduleData,
  quality: AnswerQuality,
): ScheduleData {
  const rating = QUALITY_TO_RATING[quality];
  const now = new Date();

  // Reconstruct a ts-fsrs Card from our ScheduleData
  const card: FSRSCard = {
    due: new Date(schedule.due),
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: schedule.reps,
    lapses: schedule.lapses,
    state: STRING_TO_STATE[schedule.state],
    last_review: schedule.lastReview
      ? new Date(schedule.lastReview)
      : undefined,
  };

  // Use f.next() to get the result for the specific rating
  const result = f.next(card, now, rating);
  const nextCard = result.card;

  return {
    cardId: schedule.cardId,
    difficulty: nextCard.difficulty,
    stability: nextCard.stability,
    reps: nextCard.reps,
    lapses: nextCard.lapses,
    state: STATE_TO_STRING[nextCard.state],
    due: nextCard.due.toISOString(),
    lastReview: nextCard.last_review
      ? nextCard.last_review.toISOString()
      : now.toISOString(),
  };
}

export function isDueForReview(schedule: ScheduleData): boolean {
  return new Date(schedule.due) <= new Date();
}

/**
 * Compute retrievability using the FSRS forgetting curve.
 * For new cards (stability === 0), returns 1.0.
 */
export function getRetrievability(schedule: ScheduleData): number {
  if (schedule.state === "new" || schedule.stability === 0) {
    return 1.0;
  }

  // Reconstruct a ts-fsrs Card to use get_retrievability
  const card: FSRSCard = {
    due: new Date(schedule.due),
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: schedule.reps,
    lapses: schedule.lapses,
    state: STRING_TO_STATE[schedule.state],
    last_review: schedule.lastReview
      ? new Date(schedule.lastReview)
      : undefined,
  };

  return f.get_retrievability(card, new Date(), false);
}
