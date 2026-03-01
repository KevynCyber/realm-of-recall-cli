import { describe, it, expect } from "vitest";
import {
  updateStreak,
  getStreakBonus,
  isStreakAtRisk,
  getStreakTitle,
  getYesterday,
  calculateStreakDecay,
  calculateEarnBack,
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
    skillRecall: 0,
    skillBattle: 0,
    skillScholar: 0,
    dailyChallengeSeed: null,
    dailyChallengeCompleted: false,
    dailyChallengeScore: 0,
    dailyChallengeDate: null,
    desiredRetention: 0.9,
    maxNewCardsPerDay: 20,
    timerSeconds: 30,
    lastLoginAt: null,
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

// ---------- calculateStreakDecay ----------

describe("calculateStreakDecay", () => {
  it("returns 0 for streak of 0", () => {
    expect(calculateStreakDecay(0)).toBe(0);
  });

  it("returns 0 for streak of 3 (floor(3/4) = 0)", () => {
    expect(calculateStreakDecay(3)).toBe(0);
  });

  it("returns 1 for streak of 4 (floor(4/4) = 1)", () => {
    expect(calculateStreakDecay(4)).toBe(1);
  });

  it("returns 1 for streak of 5 (floor(5/4) = 1)", () => {
    expect(calculateStreakDecay(5)).toBe(1);
  });

  it("returns 2 for streak of 8 (floor(8/4) = 2)", () => {
    expect(calculateStreakDecay(8)).toBe(2);
  });

  it("returns 5 for streak of 20 (min(5, floor(20/4)) = 5)", () => {
    expect(calculateStreakDecay(20)).toBe(5);
  });

  it("caps at 5 for streak of 100 (min(5, floor(100/4)) = 5)", () => {
    expect(calculateStreakDecay(100)).toBe(5);
  });

  it("returns 3 for streak of 12 (floor(12/4) = 3)", () => {
    expect(calculateStreakDecay(12)).toBe(3);
  });
});

// ---------- calculateEarnBack ----------

describe("calculateEarnBack", () => {
  it("returns 0 for 0 decay", () => {
    expect(calculateEarnBack(0)).toBe(0);
  });

  it("returns 1 for decay of 1 (max(1, floor(1/2)) = 1)", () => {
    expect(calculateEarnBack(1)).toBe(1);
  });

  it("returns 1 for decay of 2 (floor(2/2) = 1)", () => {
    expect(calculateEarnBack(2)).toBe(1);
  });

  it("returns 1 for decay of 3 (floor(3/2) = 1, but max 1)", () => {
    expect(calculateEarnBack(3)).toBe(1);
  });

  it("returns 2 for decay of 4 (floor(4/2) = 2)", () => {
    expect(calculateEarnBack(4)).toBe(2);
  });

  it("returns 2 for decay of 5 (floor(5/2) = 2)", () => {
    expect(calculateEarnBack(5)).toBe(2);
  });
});

// ---------- updateStreak ----------

describe("updateStreak", () => {
  it("first review sets streak to 1", () => {
    const player = makePlayer({ lastReviewDate: null, streakDays: 0 });
    const result = updateStreak(player, "2026-01-15");

    expect(result.player.streakDays).toBe(1);
    expect(result.player.lastReviewDate).toBe("2026-01-15");
    expect(result.player.longestStreak).toBe(1);
    expect(result.message).toBeNull();
  });

  it("consecutive day increments streak", () => {
    const player = makePlayer({
      lastReviewDate: "2026-01-15",
      streakDays: 3,
      longestStreak: 3,
    });
    const result = updateStreak(player, "2026-01-16");

    expect(result.player.streakDays).toBe(4);
    expect(result.player.lastReviewDate).toBe("2026-01-16");
    expect(result.player.longestStreak).toBe(4);
    expect(result.message).toBeNull();
  });

  it("shield prevents streak decay and treats as consecutive", () => {
    const player = makePlayer({
      lastReviewDate: "2026-01-14",
      streakDays: 5,
      longestStreak: 5,
      shieldCount: 2,
    });
    const result = updateStreak(player, "2026-01-16");

    expect(result.player.streakDays).toBe(6);
    expect(result.player.lastReviewDate).toBe("2026-01-16");
    expect(result.message).toBeNull();
  });

  it("shield consumed: shieldCount decreases by 1", () => {
    const player = makePlayer({
      lastReviewDate: "2026-01-14",
      streakDays: 5,
      longestStreak: 5,
      shieldCount: 2,
    });
    const result = updateStreak(player, "2026-01-16");

    expect(result.player.shieldCount).toBe(1);
  });

  it("multiple skipped days with enough shields still uses only one shield", () => {
    // Skipped 3 days: last review on Jan 12, today is Jan 16
    const player = makePlayer({
      lastReviewDate: "2026-01-12",
      streakDays: 10,
      longestStreak: 10,
      shieldCount: 3,
    });
    const result = updateStreak(player, "2026-01-16");

    // Shield covers the gap — streak increments, one shield consumed
    expect(result.player.streakDays).toBe(11);
    expect(result.player.shieldCount).toBe(2);
    expect(result.player.lastReviewDate).toBe("2026-01-16");
  });

  it("same day review does not change streak", () => {
    const player = makePlayer({
      lastReviewDate: "2026-01-15",
      streakDays: 3,
      longestStreak: 5,
      shieldCount: 1,
    });
    const result = updateStreak(player, "2026-01-15");

    expect(result.player).toBe(player); // reference-equal — no change
    expect(result.player.streakDays).toBe(3);
    expect(result.player.shieldCount).toBe(1);
    expect(result.message).toBeNull();
  });

  it("longestStreak updates when current streak exceeds it", () => {
    const player = makePlayer({
      lastReviewDate: "2026-01-15",
      streakDays: 7,
      longestStreak: 7,
    });
    const result = updateStreak(player, "2026-01-16");

    expect(result.player.streakDays).toBe(8);
    expect(result.player.longestStreak).toBe(8);
  });

  it("longestStreak is preserved when current streak is lower after decay", () => {
    // streak=3, decay=floor(3/4)=0, so streak stays 3+1=4 (no decay for small streaks)
    // Use a bigger streak to trigger decay
    const player = makePlayer({
      lastReviewDate: "2026-01-12",
      streakDays: 20,
      longestStreak: 20,
      shieldCount: 0,
    });
    const result = updateStreak(player, "2026-01-16");

    // decay = min(5, floor(20/4)) = 5, no earn-back (missed 3 days, not exactly 1)
    // newStreak = 20 - 5 = 15, then +1 for today = 16
    expect(result.player.streakDays).toBe(16);
    expect(result.player.longestStreak).toBe(20);
  });

  // ---------- Decay model tests ----------

  describe("decay model", () => {
    it("applies decay instead of hard reset: streak 20 with 1 missed day", () => {
      // Last review 2 days ago (missed exactly yesterday)
      const player = makePlayer({
        lastReviewDate: "2026-01-14",
        streakDays: 20,
        longestStreak: 20,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = min(5, floor(20/4)) = 5
      // earn-back = floor(5/2) = 2 (missed exactly 1 day)
      // newStreak = 20 - 5 + 2 = 17, then +1 for today = 18
      expect(result.player.streakDays).toBe(18);
      expect(result.player.lastReviewDate).toBe("2026-01-16");
      expect(result.message).toBe("Streak reduced to 17 days (was 20)");
    });

    it("applies decay for small streak: streak 5 with 1 missed day", () => {
      const player = makePlayer({
        lastReviewDate: "2026-01-14",
        streakDays: 5,
        longestStreak: 5,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = min(5, floor(5/4)) = 1
      // earn-back = max(1, floor(1/2)) = 1 (missed exactly 1 day)
      // newStreak = 5 - 1 + 1 = 5, then +1 for today = 6
      expect(result.player.streakDays).toBe(6);
      expect(result.message).toBe("Streak reduced to 5 days (was 5)");
    });

    it("applies decay with no earn-back when multiple days missed", () => {
      // Last review 4 days ago (missed 3 days)
      const player = makePlayer({
        lastReviewDate: "2026-01-12",
        streakDays: 20,
        longestStreak: 20,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = min(5, floor(20/4)) = 5
      // earn-back = 0 (missed more than 1 day)
      // newStreak = 20 - 5 = 15, then +1 for today = 16
      expect(result.player.streakDays).toBe(16);
      expect(result.message).toBe("Streak reduced to 15 days (was 20)");
    });

    it("streak of 3 has 0 decay (floor(3/4) = 0), so it stays", () => {
      const player = makePlayer({
        lastReviewDate: "2026-01-14",
        streakDays: 3,
        longestStreak: 3,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = min(5, floor(3/4)) = 0
      // newStreak = 3 - 0 = 3, then +1 for today = 4
      // message shows "Streak reduced to 3 days (was 3)" even though no actual deduction
      expect(result.player.streakDays).toBe(4);
      expect(result.message).toBe("Streak reduced to 3 days (was 3)");
    });

    it("streak of 1 has 0 decay, streak stays at 1 + 1 = 2", () => {
      const player = makePlayer({
        lastReviewDate: "2026-01-14",
        streakDays: 1,
        longestStreak: 5,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = 0, newStreak = 1 + 1 = 2
      expect(result.player.streakDays).toBe(2);
      expect(result.player.longestStreak).toBe(5);
    });

    it("streak of 8 with 1 missed day: decay 2, earn-back 1", () => {
      const player = makePlayer({
        lastReviewDate: "2026-01-14",
        streakDays: 8,
        longestStreak: 8,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = min(5, floor(8/4)) = 2
      // earn-back = max(1, floor(2/2)) = 1 (missed exactly 1 day)
      // newStreak = 8 - 2 + 1 = 7, then +1 for today = 8
      expect(result.player.streakDays).toBe(8);
      expect(result.message).toBe("Streak reduced to 7 days (was 8)");
    });

    it("preserves longestStreak from old value when decay reduces streak", () => {
      const player = makePlayer({
        lastReviewDate: "2026-01-12",
        streakDays: 20,
        longestStreak: 25,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      expect(result.player.longestStreak).toBe(25);
    });

    it("updates longestStreak when old streak was the longest", () => {
      const player = makePlayer({
        lastReviewDate: "2026-01-12",
        streakDays: 30,
        longestStreak: 20,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // longestStreak should update to oldStreak (30) since 30 > 20
      expect(result.player.longestStreak).toBe(30);
    });
  });

  // ---------- Shield priority tests ----------

  describe("shield priority", () => {
    it("shields are consumed before decay is applied", () => {
      const player = makePlayer({
        lastReviewDate: "2026-01-14",
        streakDays: 20,
        longestStreak: 20,
        shieldCount: 1,
      });
      const result = updateStreak(player, "2026-01-16");

      // Shield consumed, streak increments, no decay
      expect(result.player.streakDays).toBe(21);
      expect(result.player.shieldCount).toBe(0);
      expect(result.message).toBeNull();
    });

    it("decay applies only when shields are exhausted", () => {
      const player = makePlayer({
        lastReviewDate: "2026-01-14",
        streakDays: 20,
        longestStreak: 20,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // No shields, decay applies
      expect(result.player.streakDays).toBeLessThan(21);
      expect(result.message).not.toBeNull();
    });
  });

  // ---------- Earn-back recovery tests ----------

  describe("earn-back recovery", () => {
    it("earn-back applies when exactly 1 day was missed", () => {
      // lastReviewDate = Jan 14, today = Jan 16 (missed Jan 15 only)
      const player = makePlayer({
        lastReviewDate: "2026-01-14",
        streakDays: 20,
        longestStreak: 20,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = 5, earn-back = 2
      // streak = 20 - 5 + 2 + 1 = 18
      expect(result.player.streakDays).toBe(18);
    });

    it("no earn-back when multiple days were missed", () => {
      // lastReviewDate = Jan 12, today = Jan 16 (missed Jan 13, 14, 15)
      const player = makePlayer({
        lastReviewDate: "2026-01-12",
        streakDays: 20,
        longestStreak: 20,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = 5, earn-back = 0
      // streak = 20 - 5 + 0 + 1 = 16
      expect(result.player.streakDays).toBe(16);
    });

    it("earn-back minimum is 1 when decay is small", () => {
      // streak 4, decay = floor(4/4) = 1, earn-back = max(1, floor(1/2)) = 1
      const player = makePlayer({
        lastReviewDate: "2026-01-14",
        streakDays: 4,
        longestStreak: 4,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = 1, earn-back = 1
      // streak = 4 - 1 + 1 = 4, then +1 for today = 5
      expect(result.player.streakDays).toBe(5);
    });
  });

  // ---------- Bonus tier transition tests ----------

  describe("bonus tier transitions with decay", () => {
    it("30-day streak decays but stays in 30+ tier", () => {
      const player = makePlayer({
        lastReviewDate: "2026-01-12",
        streakDays: 35,
        longestStreak: 35,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = 5, no earn-back (multi-day miss)
      // newStreak = 35 - 5 + 1 = 31
      expect(result.player.streakDays).toBe(31);
      expect(getStreakBonus(result.player.streakDays)).toBe(50); // still 30+ tier
    });

    it("decay can drop from 30+ tier to 14+ tier", () => {
      const player = makePlayer({
        lastReviewDate: "2026-01-12",
        streakDays: 30,
        longestStreak: 30,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = 5, no earn-back
      // newStreak = 30 - 5 + 1 = 26
      expect(result.player.streakDays).toBe(26);
      expect(getStreakBonus(result.player.streakDays)).toBe(30); // dropped to 14+ tier
    });

    it("decay from 14 keeps streak in 7+ tier", () => {
      const player = makePlayer({
        lastReviewDate: "2026-01-12",
        streakDays: 14,
        longestStreak: 14,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = min(5, floor(14/4)) = 3, no earn-back
      // newStreak = 14 - 3 + 1 = 12
      expect(result.player.streakDays).toBe(12);
      expect(getStreakBonus(result.player.streakDays)).toBe(20); // dropped to 7+ tier
    });

    it("very small streak has 0 decay and bonus is unchanged", () => {
      const player = makePlayer({
        lastReviewDate: "2026-01-14",
        streakDays: 3,
        longestStreak: 3,
        shieldCount: 0,
      });
      const result = updateStreak(player, "2026-01-16");

      // decay = 0, streak = 3 + 1 = 4
      expect(result.player.streakDays).toBe(4);
      expect(getStreakBonus(result.player.streakDays)).toBe(10); // 3+ tier
    });
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
