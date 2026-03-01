import { describe, it, expect } from "vitest";
import { calculateSessionCalibration } from "../../../src/core/analytics/CalibrationFeedback.js";
import { AnswerQuality, ConfidenceLevel } from "../../../src/types/index.js";

function makeResult(quality: AnswerQuality, confidence: ConfidenceLevel) {
  return { quality, confidence };
}

describe("calculateSessionCalibration", () => {
  it("returns empty buckets for empty results", () => {
    const cal = calculateSessionCalibration([]);
    expect(cal.buckets).toHaveLength(0);
    expect(cal.overconfident).toBe(false);
    expect(cal.underconfident).toBe(false);
  });

  it("computes accuracy per confidence level", () => {
    const results = [
      makeResult(AnswerQuality.Perfect, ConfidenceLevel.Instant),
      makeResult(AnswerQuality.Correct, ConfidenceLevel.Instant),
      makeResult(AnswerQuality.Wrong, ConfidenceLevel.Instant),
      makeResult(AnswerQuality.Wrong, ConfidenceLevel.Guess),
      makeResult(AnswerQuality.Perfect, ConfidenceLevel.Guess),
    ];

    const cal = calculateSessionCalibration(results);
    const instant = cal.buckets.find((b) => b.confidence === ConfidenceLevel.Instant)!;
    expect(instant.totalCards).toBe(3);
    expect(instant.correctCards).toBe(2);
    expect(instant.accuracy).toBeCloseTo(2 / 3);

    const guess = cal.buckets.find((b) => b.confidence === ConfidenceLevel.Guess)!;
    expect(guess.totalCards).toBe(2);
    expect(guess.correctCards).toBe(1);
    expect(guess.accuracy).toBe(0.5);
  });

  it("detects overconfidence when Instant accuracy < 80%", () => {
    // 3 Instant answers, only 1 correct → 33% accuracy
    const results = [
      makeResult(AnswerQuality.Wrong, ConfidenceLevel.Instant),
      makeResult(AnswerQuality.Wrong, ConfidenceLevel.Instant),
      makeResult(AnswerQuality.Perfect, ConfidenceLevel.Instant),
    ];

    const cal = calculateSessionCalibration(results);
    expect(cal.overconfident).toBe(true);
    expect(cal.overconfidenceMessage).toContain("confidence is running ahead");
  });

  it("does not flag overconfidence with too few Instant samples", () => {
    // Only 2 Instant answers (below MIN_BUCKET_SIZE of 3)
    const results = [
      makeResult(AnswerQuality.Wrong, ConfidenceLevel.Instant),
      makeResult(AnswerQuality.Wrong, ConfidenceLevel.Instant),
    ];

    const cal = calculateSessionCalibration(results);
    expect(cal.overconfident).toBe(false);
  });

  it("detects underconfidence when Guess accuracy > 50%", () => {
    // 4 Guess answers, 3 correct → 75% accuracy
    const results = [
      makeResult(AnswerQuality.Perfect, ConfidenceLevel.Guess),
      makeResult(AnswerQuality.Correct, ConfidenceLevel.Guess),
      makeResult(AnswerQuality.Correct, ConfidenceLevel.Guess),
      makeResult(AnswerQuality.Wrong, ConfidenceLevel.Guess),
    ];

    const cal = calculateSessionCalibration(results);
    expect(cal.underconfident).toBe(true);
    expect(cal.underconfidenceMessage).toContain("know more than you think");
  });

  it("does not flag underconfidence with too few Guess samples", () => {
    const results = [
      makeResult(AnswerQuality.Perfect, ConfidenceLevel.Guess),
      makeResult(AnswerQuality.Perfect, ConfidenceLevel.Guess),
    ];

    const cal = calculateSessionCalibration(results);
    expect(cal.underconfident).toBe(false);
  });

  it("well-calibrated session has no flags", () => {
    // Instant: 5/5 correct (100%), Guess: 1/4 correct (25%)
    const results = [
      ...Array(5).fill(null).map(() => makeResult(AnswerQuality.Perfect, ConfidenceLevel.Instant)),
      makeResult(AnswerQuality.Perfect, ConfidenceLevel.Guess),
      makeResult(AnswerQuality.Wrong, ConfidenceLevel.Guess),
      makeResult(AnswerQuality.Wrong, ConfidenceLevel.Guess),
      makeResult(AnswerQuality.Wrong, ConfidenceLevel.Guess),
    ];

    const cal = calculateSessionCalibration(results);
    expect(cal.overconfident).toBe(false);
    expect(cal.underconfident).toBe(false);
    expect(cal.overconfidenceMessage).toBeNull();
    expect(cal.underconfidenceMessage).toBeNull();
  });

  it("Partial and Timeout count as incorrect for calibration", () => {
    const results = [
      makeResult(AnswerQuality.Partial, ConfidenceLevel.Instant),
      makeResult(AnswerQuality.Timeout, ConfidenceLevel.Instant),
      makeResult(AnswerQuality.Partial, ConfidenceLevel.Instant),
    ];

    const cal = calculateSessionCalibration(results);
    const instant = cal.buckets.find((b) => b.confidence === ConfidenceLevel.Instant)!;
    expect(instant.correctCards).toBe(0);
    expect(cal.overconfident).toBe(true);
  });

  it("orders buckets as Guess, Knew, Instant", () => {
    const results = [
      makeResult(AnswerQuality.Perfect, ConfidenceLevel.Instant),
      makeResult(AnswerQuality.Perfect, ConfidenceLevel.Guess),
      makeResult(AnswerQuality.Perfect, ConfidenceLevel.Knew),
    ];

    const cal = calculateSessionCalibration(results);
    expect(cal.buckets[0].confidence).toBe(ConfidenceLevel.Guess);
    expect(cal.buckets[1].confidence).toBe(ConfidenceLevel.Knew);
    expect(cal.buckets[2].confidence).toBe(ConfidenceLevel.Instant);
  });
});
