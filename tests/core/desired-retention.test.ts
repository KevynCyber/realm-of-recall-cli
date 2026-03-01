import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialSchedule,
  updateSchedule,
} from "../../src/core/spaced-repetition/Scheduler.js";
import { AnswerQuality } from "../../src/types/index.js";

describe("Desired Retention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("default (0.9) produces valid schedule", () => {
    const s = createInitialSchedule("card1");
    const updated = updateSchedule(s, AnswerQuality.Correct, undefined, 0.9);
    expect(updated.stability).toBeGreaterThan(0);
    expect(["learning", "review"]).toContain(updated.state);
  });

  it("updateSchedule works without desiredRetention (backward compatible)", () => {
    const s = createInitialSchedule("card1");
    const updated = updateSchedule(s, AnswerQuality.Correct);
    expect(updated.stability).toBeGreaterThan(0);
  });

  it("different retention values produce different scheduling intervals for review cards", () => {
    // Build up a card to review state first
    let baseLow = createInitialSchedule("cardLow");
    let baseHigh = createInitialSchedule("cardHigh");

    // Get both cards into review state with several Good answers
    for (let i = 0; i < 10; i++) {
      baseLow = updateSchedule(baseLow, AnswerQuality.Correct, undefined, 0.7);
      vi.setSystemTime(new Date(new Date(baseLow.due).getTime() + 1000));
    }

    // Reset time for high retention card
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));

    for (let i = 0; i < 10; i++) {
      baseHigh = updateSchedule(baseHigh, AnswerQuality.Correct, undefined, 0.97);
      vi.setSystemTime(new Date(new Date(baseHigh.due).getTime() + 1000));
    }

    // Both should be valid schedules
    expect(baseLow.stability).toBeGreaterThan(0);
    expect(baseHigh.stability).toBeGreaterThan(0);

    // With lower retention (0.7), intervals should be longer (fewer reviews needed)
    // With higher retention (0.97), intervals should be shorter (more reviews needed)
    // The due dates reflect this: low retention = further out, high retention = sooner
    // We compare the due-vs-lastReview gap
    const lowInterval = new Date(baseLow.due).getTime() - new Date(baseLow.lastReview).getTime();
    const highInterval = new Date(baseHigh.due).getTime() - new Date(baseHigh.lastReview).getTime();

    // Lower desired retention -> longer intervals (card can decay more before review)
    // Higher desired retention -> shorter intervals (card needs review sooner)
    expect(lowInterval).toBeGreaterThan(highInterval);
  });

  it("0.7 retention produces longer intervals than 0.95 retention", () => {
    // Start both from same initial state, do one review to get into learning
    const s = createInitialSchedule("card1");

    // Move to review state
    let reviewCard = s;
    for (let i = 0; i < 10; i++) {
      reviewCard = updateSchedule(reviewCard, AnswerQuality.Correct);
      vi.setSystemTime(new Date(new Date(reviewCard.due).getTime() + 1000));
      if (reviewCard.state === "review") break;
    }

    // Now apply different retention values from the same state
    if (reviewCard.state === "review") {
      vi.setSystemTime(new Date(new Date(reviewCard.due).getTime() + 1000));

      const lowRetention = updateSchedule(reviewCard, AnswerQuality.Correct, undefined, 0.70);
      const highRetention = updateSchedule(reviewCard, AnswerQuality.Correct, undefined, 0.95);

      const lowDue = new Date(lowRetention.due).getTime();
      const highDue = new Date(highRetention.due).getTime();

      // Lower retention = longer interval = later due date
      expect(lowDue).toBeGreaterThan(highDue);
    }
  });

  it("retention value at boundary 0.70 works", () => {
    const s = createInitialSchedule("card1");
    const updated = updateSchedule(s, AnswerQuality.Correct, undefined, 0.70);
    expect(updated.stability).toBeGreaterThan(0);
    expect(updated.reps).toBe(1);
  });

  it("retention value at boundary 0.97 works", () => {
    const s = createInitialSchedule("card1");
    const updated = updateSchedule(s, AnswerQuality.Correct, undefined, 0.97);
    expect(updated.stability).toBeGreaterThan(0);
    expect(updated.reps).toBe(1);
  });
});
