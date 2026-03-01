import { describe, it, expect } from "vitest";
import {
  isLearningComplete,
  shouldRequeueCard,
  getLearningProgress,
  isOverlearning,
  DEFAULT_LEARNING_THRESHOLD,
  OVERLEARNING_THRESHOLD,
  OVERLEARNING_MESSAGE,
} from "../../../src/core/review/LearningGate.js";

// ---------------------------------------------------------------------------
// isLearningComplete
// ---------------------------------------------------------------------------
describe("isLearningComplete", () => {
  it("returns false when consecutiveCorrect is 0", () => {
    expect(isLearningComplete(0)).toBe(false);
  });

  it("returns false when below default threshold", () => {
    expect(isLearningComplete(1)).toBe(false);
    expect(isLearningComplete(2)).toBe(false);
  });

  it("returns true when exactly at default threshold (3)", () => {
    expect(isLearningComplete(3)).toBe(true);
  });

  it("returns true when above default threshold", () => {
    expect(isLearningComplete(5)).toBe(true);
    expect(isLearningComplete(100)).toBe(true);
  });

  it("respects a custom threshold", () => {
    expect(isLearningComplete(4, 5)).toBe(false);
    expect(isLearningComplete(5, 5)).toBe(true);
    expect(isLearningComplete(6, 5)).toBe(true);
  });

  it("threshold of 1 means a single correct answer completes learning", () => {
    expect(isLearningComplete(0, 1)).toBe(false);
    expect(isLearningComplete(1, 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shouldRequeueCard
// ---------------------------------------------------------------------------
describe("shouldRequeueCard", () => {
  it("requeues a learning card that has not met the threshold", () => {
    expect(shouldRequeueCard("learning", 0)).toBe(true);
    expect(shouldRequeueCard("learning", 1)).toBe(true);
    expect(shouldRequeueCard("learning", 2)).toBe(true);
  });

  it("does not requeue a learning card that has met the threshold", () => {
    expect(shouldRequeueCard("learning", 3)).toBe(false);
    expect(shouldRequeueCard("learning", 4)).toBe(false);
  });

  it("does not requeue 'review' cards regardless of streak", () => {
    expect(shouldRequeueCard("review", 0)).toBe(false);
    expect(shouldRequeueCard("review", 2)).toBe(false);
  });

  it("does not requeue 'mastered' cards", () => {
    expect(shouldRequeueCard("mastered", 0)).toBe(false);
  });

  it("does not requeue 'new' cards", () => {
    expect(shouldRequeueCard("new", 0)).toBe(false);
    expect(shouldRequeueCard("new", 1)).toBe(false);
  });

  it("does not requeue 'relearning' cards", () => {
    expect(shouldRequeueCard("relearning", 0)).toBe(false);
  });

  it("respects a custom threshold for learning cards", () => {
    expect(shouldRequeueCard("learning", 4, 5)).toBe(true);
    expect(shouldRequeueCard("learning", 5, 5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getLearningProgress
// ---------------------------------------------------------------------------
describe("getLearningProgress", () => {
  it("returns initial progress (0 correct)", () => {
    const progress = getLearningProgress(0);
    expect(progress).toEqual({ current: 0, required: 3, complete: false });
  });

  it("returns mid-progress", () => {
    const progress = getLearningProgress(2);
    expect(progress).toEqual({ current: 2, required: 3, complete: false });
  });

  it("returns complete when at threshold", () => {
    const progress = getLearningProgress(3);
    expect(progress).toEqual({ current: 3, required: 3, complete: true });
  });

  it("returns complete when above threshold", () => {
    const progress = getLearningProgress(5);
    expect(progress).toEqual({ current: 5, required: 3, complete: true });
  });

  it("uses a custom threshold", () => {
    const progress = getLearningProgress(3, 5);
    expect(progress).toEqual({ current: 3, required: 5, complete: false });

    const done = getLearningProgress(5, 5);
    expect(done).toEqual({ current: 5, required: 5, complete: true });
  });
});

// ---------------------------------------------------------------------------
// isOverlearning
// ---------------------------------------------------------------------------
describe("isOverlearning", () => {
  it("returns false when correctInSession is 0", () => {
    expect(isOverlearning(0)).toBe(false);
  });

  it("returns false when below overlearning threshold", () => {
    expect(isOverlearning(1)).toBe(false);
    expect(isOverlearning(4)).toBe(false);
  });

  it("returns true when exactly at overlearning threshold (5)", () => {
    expect(isOverlearning(5)).toBe(true);
  });

  it("returns true when above overlearning threshold", () => {
    expect(isOverlearning(6)).toBe(true);
    expect(isOverlearning(99)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------
describe("constants", () => {
  it("DEFAULT_LEARNING_THRESHOLD is 3", () => {
    expect(DEFAULT_LEARNING_THRESHOLD).toBe(3);
  });

  it("OVERLEARNING_THRESHOLD is 5", () => {
    expect(OVERLEARNING_THRESHOLD).toBe(5);
  });

  it("OVERLEARNING_MESSAGE is the expected string", () => {
    expect(OVERLEARNING_MESSAGE).toBe(
      "This card is battle-ready. Spacing will help more than drilling now.",
    );
  });
});
