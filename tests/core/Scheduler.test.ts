import { describe, it, expect } from "vitest";
import {
  createInitialSchedule,
  updateSchedule,
  isDueForReview,
} from "../../src/core/spaced-repetition/Scheduler.js";
import { AnswerQuality } from "../../src/types/index.js";

describe("SM-2 Scheduler", () => {
  it("creates initial schedule with default values", () => {
    const s = createInitialSchedule("card1");
    expect(s.easeFactor).toBe(2.5);
    expect(s.intervalDays).toBe(0);
    expect(s.repetitions).toBe(0);
    expect(s.cardId).toBe("card1");
  });

  it("first correct answer sets interval to 1 day", () => {
    const s = createInitialSchedule("card1");
    const updated = updateSchedule(s, AnswerQuality.Correct);
    expect(updated.repetitions).toBe(1);
    expect(updated.intervalDays).toBe(1);
  });

  it("second correct answer sets interval to 6 days", () => {
    let s = createInitialSchedule("card1");
    s = updateSchedule(s, AnswerQuality.Correct);
    s = updateSchedule(s, AnswerQuality.Correct);
    expect(s.repetitions).toBe(2);
    expect(s.intervalDays).toBe(6);
  });

  it("third correct answer uses ease factor", () => {
    let s = createInitialSchedule("card1");
    s = updateSchedule(s, AnswerQuality.Correct);
    s = updateSchedule(s, AnswerQuality.Correct);
    s = updateSchedule(s, AnswerQuality.Correct);
    expect(s.repetitions).toBe(3);
    // interval = round(6 * easeFactor)
    expect(s.intervalDays).toBeGreaterThan(6);
  });

  it("wrong answer resets repetitions", () => {
    let s = createInitialSchedule("card1");
    s = updateSchedule(s, AnswerQuality.Correct);
    s = updateSchedule(s, AnswerQuality.Correct);
    expect(s.repetitions).toBe(2);

    s = updateSchedule(s, AnswerQuality.Wrong);
    expect(s.repetitions).toBe(0);
    expect(s.intervalDays).toBe(1);
  });

  it("timeout resets repetitions", () => {
    let s = createInitialSchedule("card1");
    s = updateSchedule(s, AnswerQuality.Correct);
    s = updateSchedule(s, AnswerQuality.Timeout);
    expect(s.repetitions).toBe(0);
  });

  it("perfect answers increase ease factor", () => {
    let s = createInitialSchedule("card1");
    const initialEase = s.easeFactor;
    s = updateSchedule(s, AnswerQuality.Perfect);
    expect(s.easeFactor).toBeGreaterThan(initialEase);
  });

  it("wrong answers decrease ease factor", () => {
    let s = createInitialSchedule("card1");
    const initialEase = s.easeFactor;
    s = updateSchedule(s, AnswerQuality.Wrong);
    expect(s.easeFactor).toBeLessThan(initialEase);
  });

  it("ease factor never goes below 1.3", () => {
    let s = createInitialSchedule("card1");
    // Hammer it with wrong answers
    for (let i = 0; i < 20; i++) {
      s = updateSchedule(s, AnswerQuality.Wrong);
    }
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("partial answer counts as success (q=3)", () => {
    let s = createInitialSchedule("card1");
    s = updateSchedule(s, AnswerQuality.Partial);
    expect(s.repetitions).toBe(1);
    expect(s.intervalDays).toBe(1);
  });

  it("isDueForReview returns true for past dates", () => {
    const s = createInitialSchedule("card1");
    s.nextReviewAt = new Date(Date.now() - 86400000).toISOString(); // yesterday
    expect(isDueForReview(s)).toBe(true);
  });

  it("isDueForReview returns false for future dates", () => {
    const s = createInitialSchedule("card1");
    s.nextReviewAt = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    expect(isDueForReview(s)).toBe(false);
  });
});
