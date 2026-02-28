import { describe, it, expect } from "vitest";
import { RecallTracker } from "../../src/core/spaced-repetition/RecallStats.js";
import { AnswerQuality, CardDifficulty } from "../../src/types/index.js";

describe("RecallTracker", () => {
  it("tracks attempts and accuracy", () => {
    const tracker = new RecallTracker();
    tracker.recordAttempt("c1", true, 2);
    tracker.recordAttempt("c1", true, 3);
    tracker.recordAttempt("c1", false, 5);

    expect(tracker.getAccuracy("c1")).toBeCloseTo(2 / 3);
    expect(tracker.getAttempts("c1")).toHaveLength(3);
  });

  it("tracks streaks", () => {
    const tracker = new RecallTracker();
    tracker.recordAttempt("c1", true);
    tracker.recordAttempt("c1", true);
    tracker.recordAttempt("c1", true);
    expect(tracker.getStreak("c1")).toBe(3);
    expect(tracker.getBestStreak("c1")).toBe(3);

    tracker.recordAttempt("c1", false);
    expect(tracker.getStreak("c1")).toBe(0);
    expect(tracker.getBestStreak("c1")).toBe(3);
  });

  it("calculates difficulty", () => {
    const tracker = new RecallTracker();
    // 100% accuracy = Easy
    for (let i = 0; i < 10; i++) tracker.recordAttempt("easy", true);
    expect(tracker.getDifficulty("easy")).toBe(CardDifficulty.Easy);

    // 70% accuracy = Medium
    for (let i = 0; i < 7; i++) tracker.recordAttempt("med", true);
    for (let i = 0; i < 3; i++) tracker.recordAttempt("med", false);
    expect(tracker.getDifficulty("med")).toBe(CardDifficulty.Medium);

    // 30% accuracy = Hard
    for (let i = 0; i < 3; i++) tracker.recordAttempt("hard", true);
    for (let i = 0; i < 7; i++) tracker.recordAttempt("hard", false);
    expect(tracker.getDifficulty("hard")).toBe(CardDifficulty.Hard);
  });

  it("returns Medium difficulty for unknown cards", () => {
    const tracker = new RecallTracker();
    expect(tracker.getDifficulty("unknown")).toBe(CardDifficulty.Medium);
  });

  it("finds weak cards", () => {
    const tracker = new RecallTracker();
    for (let i = 0; i < 10; i++) tracker.recordAttempt("strong", true);
    for (let i = 0; i < 10; i++) tracker.recordAttempt("weak", false);
    tracker.recordAttempt("medium", true);
    tracker.recordAttempt("medium", false);

    const weak = tracker.getWeakCards(2);
    expect(weak[0]).toBe("weak");
  });

  it("counts mastered cards", () => {
    const tracker = new RecallTracker();
    // Need 10+ attempts and >90% accuracy
    for (let i = 0; i < 10; i++) tracker.recordAttempt("mastered", true);
    expect(tracker.getMasteredCount()).toBe(1);

    // Not enough attempts
    for (let i = 0; i < 5; i++) tracker.recordAttempt("novice", true);
    expect(tracker.getMasteredCount()).toBe(1);
  });

  it("returns 0 accuracy for unknown cards", () => {
    const tracker = new RecallTracker();
    expect(tracker.getAccuracy("unknown")).toBe(0);
  });

  it("calculates average response time", () => {
    const tracker = new RecallTracker();
    tracker.recordAttempt("c1", true, 2);
    tracker.recordAttempt("c1", true, 4);
    expect(tracker.getAverageResponseTime("c1")).toBe(3);
  });
});
