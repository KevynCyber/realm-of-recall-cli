import { describe, it, expect } from "vitest";
import {
  updateStreak,
  getStreakBonus,
  isStreakAtRisk,
  getStreakTitle,
  getYesterday,
} from "../../src/core/progression/StreakTracker.js";
import { PlayerClass, type Player } from "../../src/types/player.js";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: "TestHero",
    class: PlayerClass.Scholar,
    level: 1,
    xp: 0,
    hp: 50,
    maxHp: 50,
    attack: 10,
    defense: 5,
    gold: 0,
    streakDays: 0,
    longestStreak: 0,
    lastReviewDate: null,
    shieldCount: 0,
    totalReviews: 0,
    totalCorrect: 0,
    combatWins: 0,
    combatLosses: 0,
    wisdomXp: 0,
    ascensionLevel: 0,
    skillPoints: 0,
    dailyChallengeSeed: null,
    dailyChallengeCompleted: false,
    dailyChallengeScore: 0,
    dailyChallengeDate: null,
    desiredRetention: 0.9,
    maxNewCardsPerDay: 20,
    timerSeconds: 30,
    createdAt: "2026-01-01",
    ...overrides,
  };
}

// ---------- getYesterday helper ----------

describe("getYesterday", () => {
  it("returns the previous day for a normal date", () => {
    expect(getYesterday("2026-01-16")).toBe("2026-01-15");
  });

  it("handles month boundaries", () => {
    expect(getYesterday("2026-02-01")).toBe("2026-01-31");
  });

  it("handles year boundaries", () => {
    expect(getYesterday("2026-01-01")).toBe("2025-12-31");
  });
});

// ---------- updateStreak ----------

describe("updateStreak", () => {
  it("first review sets streak to 1", () => {
    const player = makePlayer({ lastReviewDate: null, streakDays: 0 });
    const updated = updateStreak(player, "2026-01-15");

    expect(updated.streakDays).toBe(1);
    expect(updated.lastReviewDate).toBe("2026-01-15");
    expect(updated.longestStreak).toBe(1);
  });

  it("consecutive day increments streak", () => {
    const player = makePlayer({
      lastReviewDate: "2026-01-15",
      streakDays: 3,
      longestStreak: 3,
    });
    const updated = updateStreak(player, "2026-01-16");

    expect(updated.streakDays).toBe(4);
    expect(updated.lastReviewDate).toBe("2026-01-16");
    expect(updated.longestStreak).toBe(4);
  });

  it("skipped day resets streak to 1 when no shields", () => {
    const player = makePlayer({
      lastReviewDate: "2026-01-14",
      streakDays: 5,
      longestStreak: 5,
      shieldCount: 0,
    });
    const updated = updateStreak(player, "2026-01-16");

    expect(updated.streakDays).toBe(1);
    expect(updated.lastReviewDate).toBe("2026-01-16");
  });

  it("shield prevents streak reset and treats as consecutive", () => {
    const player = makePlayer({
      lastReviewDate: "2026-01-14",
      streakDays: 5,
      longestStreak: 5,
      shieldCount: 2,
    });
    const updated = updateStreak(player, "2026-01-16");

    expect(updated.streakDays).toBe(6);
    expect(updated.lastReviewDate).toBe("2026-01-16");
  });

  it("shield consumed: shieldCount decreases by 1", () => {
    const player = makePlayer({
      lastReviewDate: "2026-01-14",
      streakDays: 5,
      longestStreak: 5,
      shieldCount: 2,
    });
    const updated = updateStreak(player, "2026-01-16");

    expect(updated.shieldCount).toBe(1);
  });

  it("multiple skipped days with enough shields still uses only one shield", () => {
    // Skipped 3 days: last review on Jan 12, today is Jan 16
    const player = makePlayer({
      lastReviewDate: "2026-01-12",
      streakDays: 10,
      longestStreak: 10,
      shieldCount: 3,
    });
    const updated = updateStreak(player, "2026-01-16");

    // Shield covers the gap — streak increments, one shield consumed
    expect(updated.streakDays).toBe(11);
    expect(updated.shieldCount).toBe(2);
    expect(updated.lastReviewDate).toBe("2026-01-16");
  });

  it("same day review does not change streak", () => {
    const player = makePlayer({
      lastReviewDate: "2026-01-15",
      streakDays: 3,
      longestStreak: 5,
      shieldCount: 1,
    });
    const updated = updateStreak(player, "2026-01-15");

    expect(updated).toBe(player); // reference-equal — no change
    expect(updated.streakDays).toBe(3);
    expect(updated.shieldCount).toBe(1);
  });

  it("longestStreak updates when current streak exceeds it", () => {
    const player = makePlayer({
      lastReviewDate: "2026-01-15",
      streakDays: 7,
      longestStreak: 7,
    });
    const updated = updateStreak(player, "2026-01-16");

    expect(updated.streakDays).toBe(8);
    expect(updated.longestStreak).toBe(8);
  });

  it("longestStreak is preserved when current streak is lower", () => {
    const player = makePlayer({
      lastReviewDate: "2026-01-14",
      streakDays: 3,
      longestStreak: 20,
      shieldCount: 0,
    });
    const updated = updateStreak(player, "2026-01-16");

    // Streak resets to 1, but longestStreak stays 20
    expect(updated.streakDays).toBe(1);
    expect(updated.longestStreak).toBe(20);
  });
});

// ---------- getStreakBonus ----------

describe("getStreakBonus", () => {
  it("returns 0 for 0 days", () => {
    expect(getStreakBonus(0)).toBe(0);
  });

  it("returns 0 for 2 days", () => {
    expect(getStreakBonus(2)).toBe(0);
  });

  it("returns 10 for 3 days", () => {
    expect(getStreakBonus(3)).toBe(10);
  });

  it("returns 10 for 6 days", () => {
    expect(getStreakBonus(6)).toBe(10);
  });

  it("returns 20 for 7 days", () => {
    expect(getStreakBonus(7)).toBe(20);
  });

  it("returns 20 for 13 days", () => {
    expect(getStreakBonus(13)).toBe(20);
  });

  it("returns 30 for 14 days", () => {
    expect(getStreakBonus(14)).toBe(30);
  });

  it("returns 30 for 29 days", () => {
    expect(getStreakBonus(29)).toBe(30);
  });

  it("returns 50 for 30 days", () => {
    expect(getStreakBonus(30)).toBe(50);
  });

  it("returns 50 for 100 days", () => {
    expect(getStreakBonus(100)).toBe(50);
  });
});

// ---------- isStreakAtRisk ----------

describe("isStreakAtRisk", () => {
  it("returns false when player has already reviewed today", () => {
    const player = makePlayer({ lastReviewDate: "2026-01-15" });
    expect(isStreakAtRisk(player, "2026-01-15")).toBe(false);
  });

  it("returns true when player has not reviewed today", () => {
    const player = makePlayer({ lastReviewDate: "2026-01-14" });
    expect(isStreakAtRisk(player, "2026-01-15")).toBe(true);
  });

  it("returns true when lastReviewDate is null", () => {
    const player = makePlayer({ lastReviewDate: null });
    expect(isStreakAtRisk(player, "2026-01-15")).toBe(true);
  });
});

// ---------- getStreakTitle ----------

describe("getStreakTitle", () => {
  it("returns 'Newcomer' for 0 days", () => {
    expect(getStreakTitle(0)).toBe("Newcomer");
  });

  it("returns 'Newcomer' for 6 days", () => {
    expect(getStreakTitle(6)).toBe("Newcomer");
  });

  it("returns 'Dedicated' for 7 days", () => {
    expect(getStreakTitle(7)).toBe("Dedicated");
  });

  it("returns 'Dedicated' for 13 days", () => {
    expect(getStreakTitle(13)).toBe("Dedicated");
  });

  it("returns 'Committed' for 14 days", () => {
    expect(getStreakTitle(14)).toBe("Committed");
  });

  it("returns 'Committed' for 29 days", () => {
    expect(getStreakTitle(29)).toBe("Committed");
  });

  it("returns 'Master' for 30 days", () => {
    expect(getStreakTitle(30)).toBe("Master");
  });

  it("returns 'Master' for 99 days", () => {
    expect(getStreakTitle(99)).toBe("Master");
  });

  it("returns 'Legend' for 100 days", () => {
    expect(getStreakTitle(100)).toBe("Legend");
  });

  it("returns 'Legend' for 365 days", () => {
    expect(getStreakTitle(365)).toBe("Legend");
  });
});
