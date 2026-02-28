import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Rating } from "ts-fsrs";
import {
  createInitialSchedule,
  updateSchedule,
  isDueForReview,
  getRetrievability,
  getEffectiveRating,
} from "../../src/core/spaced-repetition/Scheduler.js";
import { AnswerQuality, ConfidenceLevel } from "../../src/types/index.js";

describe("FSRS Scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createInitialSchedule", () => {
    it("returns valid defaults", () => {
      const s = createInitialSchedule("card1");
      expect(s.cardId).toBe("card1");
      expect(s.difficulty).toBe(0);
      expect(s.stability).toBe(0);
      expect(s.reps).toBe(0);
      expect(s.lapses).toBe(0);
      expect(s.state).toBe("new");
      expect(s.due).toBe(new Date("2025-01-15T12:00:00.000Z").toISOString());
      expect(s.lastReview).toBe(
        new Date("2025-01-15T12:00:00.000Z").toISOString(),
      );
    });

    it("uses different card IDs correctly", () => {
      const s1 = createInitialSchedule("abc");
      const s2 = createInitialSchedule("xyz");
      expect(s1.cardId).toBe("abc");
      expect(s2.cardId).toBe("xyz");
    });
  });

  describe("updateSchedule with Good rating", () => {
    it("transitions from new to learning or review state", () => {
      const s = createInitialSchedule("card1");
      const updated = updateSchedule(s, AnswerQuality.Correct);

      // After a Good rating on a new card, state should move to learning or review
      expect(["learning", "review"]).toContain(updated.state);
      expect(updated.reps).toBe(1);
      expect(updated.stability).toBeGreaterThan(0);
      expect(updated.difficulty).toBeGreaterThan(0);
    });
  });

  describe("updateSchedule with Again rating", () => {
    it("increases lapses for review cards", () => {
      let s = createInitialSchedule("card1");

      // Move card through learning into review state
      // Multiple Good answers to get into review
      for (let i = 0; i < 10; i++) {
        s = updateSchedule(s, AnswerQuality.Correct);
        if (s.state === "review") break;
      }

      // If we got to review state, test lapse behavior
      if (s.state === "review") {
        const lapseBefore = s.lapses;
        const updated = updateSchedule(s, AnswerQuality.Wrong);
        expect(updated.lapses).toBe(lapseBefore + 1);
        expect(["relearning", "learning"]).toContain(updated.state);
      }
    });
  });

  describe("repeated Good answers produce growing intervals", () => {
    it("intervals grow over repeated successful reviews", () => {
      let s = createInitialSchedule("card1");
      const dueDates: Date[] = [];

      // Simulate many successful reviews, advancing time to each due date
      for (let i = 0; i < 8; i++) {
        s = updateSchedule(s, AnswerQuality.Correct);
        dueDates.push(new Date(s.due));
        // Advance time to just past the due date for the next review
        vi.setSystemTime(new Date(new Date(s.due).getTime() + 1000));
      }

      // Once in review state, intervals should generally grow
      // Check that later intervals are at least as large as earlier ones
      // (comparing gaps between due dates)
      // Filter to reviews that are in "review" state (after learning phase)
      // The key property: the due dates should be getting further apart
      const intervals: number[] = [];
      for (let i = 1; i < dueDates.length; i++) {
        intervals.push(dueDates[i].getTime() - dueDates[i - 1].getTime());
      }

      // At minimum, the last interval should be larger than the first
      // (allowing for some learning-phase short intervals at the start)
      const lastInterval = intervals[intervals.length - 1];
      const firstInterval = intervals[0];
      expect(lastInterval).toBeGreaterThanOrEqual(firstInterval);
    });
  });

  describe("isDueForReview", () => {
    it("returns true when due date is in the past", () => {
      const s = createInitialSchedule("card1");
      s.due = new Date("2025-01-14T12:00:00.000Z").toISOString(); // yesterday
      expect(isDueForReview(s)).toBe(true);
    });

    it("returns true when due date is exactly now", () => {
      const s = createInitialSchedule("card1");
      s.due = new Date("2025-01-15T12:00:00.000Z").toISOString(); // exactly now
      expect(isDueForReview(s)).toBe(true);
    });

    it("returns false when due date is in the future", () => {
      const s = createInitialSchedule("card1");
      s.due = new Date("2025-01-16T12:00:00.000Z").toISOString(); // tomorrow
      expect(isDueForReview(s)).toBe(false);
    });

    it("returns true for a freshly created schedule (due is now)", () => {
      const s = createInitialSchedule("card1");
      expect(isDueForReview(s)).toBe(true);
    });
  });

  describe("difficulty stays in valid FSRS range", () => {
    it("difficulty remains between 1 and 10 after many Easy answers", () => {
      let s = createInitialSchedule("card1");
      for (let i = 0; i < 20; i++) {
        s = updateSchedule(s, AnswerQuality.Perfect);
        vi.setSystemTime(new Date(new Date(s.due).getTime() + 1000));
      }
      expect(s.difficulty).toBeGreaterThanOrEqual(1);
      expect(s.difficulty).toBeLessThanOrEqual(10);
    });

    it("difficulty remains between 1 and 10 after many Again answers", () => {
      let s = createInitialSchedule("card1");
      for (let i = 0; i < 20; i++) {
        s = updateSchedule(s, AnswerQuality.Wrong);
        vi.setSystemTime(new Date(new Date(s.due).getTime() + 1000));
      }
      expect(s.difficulty).toBeGreaterThanOrEqual(1);
      expect(s.difficulty).toBeLessThanOrEqual(10);
    });

    it("difficulty remains in range with mixed answers", () => {
      let s = createInitialSchedule("card1");
      const qualities = [
        AnswerQuality.Correct,
        AnswerQuality.Wrong,
        AnswerQuality.Perfect,
        AnswerQuality.Partial,
        AnswerQuality.Timeout,
        AnswerQuality.Correct,
        AnswerQuality.Perfect,
        AnswerQuality.Wrong,
      ];
      for (const q of qualities) {
        s = updateSchedule(s, q);
        vi.setSystemTime(new Date(new Date(s.due).getTime() + 1000));
      }
      expect(s.difficulty).toBeGreaterThanOrEqual(1);
      expect(s.difficulty).toBeLessThanOrEqual(10);
    });
  });

  describe("getRetrievability", () => {
    it("returns 1.0 for new cards", () => {
      const s = createInitialSchedule("card1");
      expect(getRetrievability(s)).toBe(1.0);
    });

    it("returns a value between 0 and 1 for reviewed cards", () => {
      let s = createInitialSchedule("card1");
      s = updateSchedule(s, AnswerQuality.Correct);

      // Advance time a bit so retrievability drops
      vi.setSystemTime(new Date(new Date(s.due).getTime() + 86400000));

      const r = getRetrievability(s);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    });
  });

  describe("quality mapping", () => {
    it("Perfect (Easy) produces lower difficulty than Wrong (Again)", () => {
      const s1 = createInitialSchedule("card1");
      const s2 = createInitialSchedule("card2");

      const afterEasy = updateSchedule(s1, AnswerQuality.Perfect);
      const afterAgain = updateSchedule(s2, AnswerQuality.Wrong);

      // Easy rating should result in lower difficulty than Again
      expect(afterEasy.difficulty).toBeLessThan(afterAgain.difficulty);
    });

    it("Timeout maps to Again (same as Wrong)", () => {
      const s1 = createInitialSchedule("card1");
      const s2 = createInitialSchedule("card2");

      const afterWrong = updateSchedule(s1, AnswerQuality.Wrong);
      const afterTimeout = updateSchedule(s2, AnswerQuality.Timeout);

      // Both map to Rating.Again, so difficulty should be the same
      expect(afterWrong.difficulty).toBe(afterTimeout.difficulty);
      expect(afterWrong.stability).toBe(afterTimeout.stability);
    });
  });

  describe("getEffectiveRating", () => {
    it("Perfect + Instant → Easy", () => {
      expect(getEffectiveRating(AnswerQuality.Perfect, ConfidenceLevel.Instant)).toBe(Rating.Easy);
    });

    it("Perfect + Knew → Good", () => {
      expect(getEffectiveRating(AnswerQuality.Perfect, ConfidenceLevel.Knew)).toBe(Rating.Good);
    });

    it("Perfect + Guess → Hard", () => {
      expect(getEffectiveRating(AnswerQuality.Perfect, ConfidenceLevel.Guess)).toBe(Rating.Hard);
    });

    it("Correct + Guess → Hard", () => {
      expect(getEffectiveRating(AnswerQuality.Correct, ConfidenceLevel.Guess)).toBe(Rating.Hard);
    });

    it("Wrong + any confidence → Again", () => {
      expect(getEffectiveRating(AnswerQuality.Wrong, ConfidenceLevel.Instant)).toBe(Rating.Again);
      expect(getEffectiveRating(AnswerQuality.Wrong, ConfidenceLevel.Knew)).toBe(Rating.Again);
      expect(getEffectiveRating(AnswerQuality.Wrong, ConfidenceLevel.Guess)).toBe(Rating.Again);
    });

    it("Timeout + any confidence → Again", () => {
      expect(getEffectiveRating(AnswerQuality.Timeout, ConfidenceLevel.Instant)).toBe(Rating.Again);
    });

    it("Partial + any confidence → Hard", () => {
      expect(getEffectiveRating(AnswerQuality.Partial, ConfidenceLevel.Instant)).toBe(Rating.Hard);
      expect(getEffectiveRating(AnswerQuality.Partial, ConfidenceLevel.Knew)).toBe(Rating.Hard);
      expect(getEffectiveRating(AnswerQuality.Partial, ConfidenceLevel.Guess)).toBe(Rating.Hard);
    });

    it("undefined confidence → uses default QUALITY_TO_RATING mapping", () => {
      expect(getEffectiveRating(AnswerQuality.Perfect)).toBe(Rating.Easy);
      expect(getEffectiveRating(AnswerQuality.Correct)).toBe(Rating.Good);
      expect(getEffectiveRating(AnswerQuality.Partial)).toBe(Rating.Hard);
      expect(getEffectiveRating(AnswerQuality.Wrong)).toBe(Rating.Again);
      expect(getEffectiveRating(AnswerQuality.Timeout)).toBe(Rating.Again);
    });
  });

  describe("updateSchedule with confidence", () => {
    it("confidence affects scheduling differently than without", () => {
      const s1 = createInitialSchedule("card1");
      const s2 = createInitialSchedule("card2");

      // Perfect without confidence → Easy rating (default)
      const withoutConfidence = updateSchedule(s1, AnswerQuality.Perfect);
      // Perfect with Guess confidence → Hard rating
      const withGuess = updateSchedule(s2, AnswerQuality.Perfect, ConfidenceLevel.Guess);

      // Hard rating produces higher difficulty than Easy rating
      expect(withGuess.difficulty).toBeGreaterThan(withoutConfidence.difficulty);
    });

    it("backward compatible: no confidence gives same result as before", () => {
      const s1 = createInitialSchedule("card1");
      const s2 = createInitialSchedule("card2");

      const withoutConfidence = updateSchedule(s1, AnswerQuality.Correct);
      const withUndefined = updateSchedule(s2, AnswerQuality.Correct, undefined);

      expect(withoutConfidence.difficulty).toBe(withUndefined.difficulty);
      expect(withoutConfidence.stability).toBe(withUndefined.stability);
    });
  });
});
