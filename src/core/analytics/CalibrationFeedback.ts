/**
 * Metacognitive calibration analysis — measures how well a learner's
 * confidence predictions match their actual recall accuracy.
 *
 * Evidence: de Bruin et al. 2017, Saenz et al. 2021 meta-analysis.
 * Poorly calibrated students use ineffective learning strategies.
 * Active calibration feedback breaks this cycle.
 */

import { AnswerQuality, ConfidenceLevel } from "../../types/index.js";

export interface CalibrationBucket {
  confidence: ConfidenceLevel;
  totalCards: number;
  correctCards: number;
  accuracy: number;
}

export interface CalibrationResult {
  buckets: CalibrationBucket[];
  overconfident: boolean;
  underconfident: boolean;
  overconfidenceMessage: string | null;
  underconfidenceMessage: string | null;
}

/** Minimum cards in a confidence bucket to produce a meaningful signal. */
const MIN_BUCKET_SIZE = 3;

/** If "Instant" accuracy is below this threshold, flag overconfidence. */
const OVERCONFIDENCE_THRESHOLD = 0.80;

/** If "Guess" accuracy is above this threshold, flag underconfidence. */
const UNDERCONFIDENCE_THRESHOLD = 0.50;

function isCorrect(quality: AnswerQuality): boolean {
  return quality === AnswerQuality.Perfect || quality === AnswerQuality.Correct;
}

/**
 * Analyze how well confidence predictions match actual performance.
 *
 * @param results Array of { quality, confidence } from a review session.
 * @returns Calibration breakdown with coaching messages.
 */
export function calculateSessionCalibration(
  results: Array<{ quality: AnswerQuality; confidence: ConfidenceLevel }>,
): CalibrationResult {
  const counts = new Map<ConfidenceLevel, { total: number; correct: number }>();

  for (const { quality, confidence } of results) {
    const bucket = counts.get(confidence) ?? { total: 0, correct: 0 };
    bucket.total++;
    if (isCorrect(quality)) bucket.correct++;
    counts.set(confidence, bucket);
  }

  const buckets: CalibrationBucket[] = [];
  for (const level of [ConfidenceLevel.Guess, ConfidenceLevel.Knew, ConfidenceLevel.Instant]) {
    const data = counts.get(level);
    if (data && data.total > 0) {
      buckets.push({
        confidence: level,
        totalCards: data.total,
        correctCards: data.correct,
        accuracy: data.correct / data.total,
      });
    }
  }

  // Check for overconfidence (Instant accuracy too low)
  const instantBucket = buckets.find((b) => b.confidence === ConfidenceLevel.Instant);
  const overconfident =
    !!instantBucket &&
    instantBucket.totalCards >= MIN_BUCKET_SIZE &&
    instantBucket.accuracy < OVERCONFIDENCE_THRESHOLD;

  // Check for underconfidence (Guess accuracy too high)
  const guessBucket = buckets.find((b) => b.confidence === ConfidenceLevel.Guess);
  const underconfident =
    !!guessBucket &&
    guessBucket.totalCards >= MIN_BUCKET_SIZE &&
    guessBucket.accuracy > UNDERCONFIDENCE_THRESHOLD;

  return {
    buckets,
    overconfident,
    underconfident,
    overconfidenceMessage: overconfident
      ? "Your confidence is running ahead of your recall. Consider rating more conservatively."
      : null,
    underconfidenceMessage: underconfident
      ? "You know more than you think! Trust your recall more."
      : null,
  };
}
