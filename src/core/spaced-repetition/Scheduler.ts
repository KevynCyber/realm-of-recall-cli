import { AnswerQuality, type LegacyScheduleData } from "../../types/index.js";

/**
 * SM-2 spaced repetition algorithm.
 *
 * Quality mapping:
 *   Perfect=5, Correct=4, Partial=3, Wrong=1, Timeout=0
 *
 * Algorithm:
 *   - quality >= 3: increment repetitions, update interval
 *   - quality < 3: reset to 0 repetitions, interval = 1
 *   - ease_factor adjusted by: -0.8 + 0.28*q - 0.02*q*q
 *   - ease_factor minimum: 1.3
 */

const QUALITY_MAP: Record<AnswerQuality, number> = {
  [AnswerQuality.Perfect]: 5,
  [AnswerQuality.Correct]: 4,
  [AnswerQuality.Partial]: 3,
  [AnswerQuality.Wrong]: 1,
  [AnswerQuality.Timeout]: 0,
};

export function createInitialSchedule(cardId: string): LegacyScheduleData {
  return {
    cardId,
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    nextReviewAt: new Date().toISOString(),
  };
}

export function updateSchedule(
  schedule: LegacyScheduleData,
  quality: AnswerQuality,
): LegacyScheduleData {
  const q = QUALITY_MAP[quality];

  let { easeFactor, intervalDays, repetitions } = schedule;

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  if (q >= 3) {
    // Successful recall
    repetitions++;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
  } else {
    // Failed recall — reset
    repetitions = 0;
    intervalDays = 1;
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervalDays);

  return {
    cardId: schedule.cardId,
    easeFactor,
    intervalDays,
    repetitions,
    nextReviewAt: nextReview.toISOString(),
  };
}

export function isDueForReview(schedule: LegacyScheduleData): boolean {
  return new Date(schedule.nextReviewAt) <= new Date();
}
