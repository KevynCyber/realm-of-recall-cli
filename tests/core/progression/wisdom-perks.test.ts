import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WISDOM_PERKS,
  getUnlockedPerks,
  hasPerk,
} from "../../../src/core/progression/WisdomPerks.js";
import { createInitialSchedule } from "../../../src/core/spaced-repetition/Scheduler.js";

// ---------------------------------------------------------------------------
// WisdomPerks definitions
// ---------------------------------------------------------------------------
describe("WISDOM_PERKS", () => {
  it("defines exactly 5 perks", () => {
    expect(WISDOM_PERKS).toHaveLength(5);
  });

  it("has thresholds in ascending order", () => {
    for (let i = 1; i < WISDOM_PERKS.length; i++) {
      expect(WISDOM_PERKS[i].threshold).toBeGreaterThan(
        WISDOM_PERKS[i - 1].threshold,
      );
    }
  });

  it("defines expected perk ids", () => {
    const ids = WISDOM_PERKS.map((p) => p.id);
    expect(ids).toEqual([
      "extra_hint",
      "study_shield",
      "quick_learner",
      "deep_focus",
      "sages_insight",
    ]);
  });

  it("defines correct thresholds", () => {
    const thresholds = WISDOM_PERKS.map((p) => p.threshold);
    expect(thresholds).toEqual([100, 250, 500, 750, 1000]);
  });
});

// ---------------------------------------------------------------------------
// getUnlockedPerks
// ---------------------------------------------------------------------------
describe("getUnlockedPerks", () => {
  it("returns empty array for 0 WXP", () => {
    expect(getUnlockedPerks(0)).toEqual([]);
  });

  it("returns empty array for 99 WXP (below first threshold)", () => {
    expect(getUnlockedPerks(99)).toEqual([]);
  });

  it("returns 1 perk at exactly 100 WXP", () => {
    const unlocked = getUnlockedPerks(100);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].id).toBe("extra_hint");
  });

  it("returns 2 perks at 250 WXP", () => {
    const unlocked = getUnlockedPerks(250);
    expect(unlocked).toHaveLength(2);
    expect(unlocked.map((p) => p.id)).toEqual(["extra_hint", "study_shield"]);
  });

  it("returns 3 perks at 500 WXP", () => {
    const unlocked = getUnlockedPerks(500);
    expect(unlocked).toHaveLength(3);
    expect(unlocked[2].id).toBe("quick_learner");
  });

  it("returns 4 perks at 750 WXP", () => {
    const unlocked = getUnlockedPerks(750);
    expect(unlocked).toHaveLength(4);
    expect(unlocked[3].id).toBe("deep_focus");
  });

  it("returns all 5 perks at 1000 WXP", () => {
    const unlocked = getUnlockedPerks(1000);
    expect(unlocked).toHaveLength(5);
    expect(unlocked[4].id).toBe("sages_insight");
  });

  it("returns all 5 perks when WXP exceeds 1000", () => {
    const unlocked = getUnlockedPerks(5000);
    expect(unlocked).toHaveLength(5);
  });

  it("returns 1 perk at 249 WXP (between first and second threshold)", () => {
    const unlocked = getUnlockedPerks(249);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].id).toBe("extra_hint");
  });
});

// ---------------------------------------------------------------------------
// hasPerk
// ---------------------------------------------------------------------------
describe("hasPerk", () => {
  it("returns false for unknown perk id", () => {
    expect(hasPerk(9999, "nonexistent")).toBe(false);
  });

  it("returns false when WXP is below threshold", () => {
    expect(hasPerk(499, "quick_learner")).toBe(false);
  });

  it("returns true when WXP equals threshold", () => {
    expect(hasPerk(500, "quick_learner")).toBe(true);
  });

  it("returns true when WXP exceeds threshold", () => {
    expect(hasPerk(999, "deep_focus")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Quick Learner perk effect in Scheduler
// ---------------------------------------------------------------------------
describe("Quick Learner perk effect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates initial schedule with 0 stability when perk is NOT unlocked", () => {
    const schedule = createInitialSchedule("card1", 0);
    expect(schedule.stability).toBe(0);
  });

  it("creates initial schedule with 0 stability when wisdomXp is undefined", () => {
    const schedule = createInitialSchedule("card1");
    expect(schedule.stability).toBe(0);
  });

  it("creates initial schedule with 0 stability at 499 WXP (below threshold)", () => {
    const schedule = createInitialSchedule("card1", 499);
    expect(schedule.stability).toBe(0);
  });

  it("creates initial schedule with 1.1 stability at 500 WXP (Quick Learner unlocked)", () => {
    const schedule = createInitialSchedule("card1", 500);
    expect(schedule.stability).toBe(1.1);
  });

  it("creates initial schedule with 1.1 stability above 500 WXP", () => {
    const schedule = createInitialSchedule("card1", 1000);
    expect(schedule.stability).toBe(1.1);
  });
});

// ---------------------------------------------------------------------------
// Deep Focus perk effect
// ---------------------------------------------------------------------------
describe("Deep Focus perk XP bonus", () => {
  it("applies +10% XP when perk is unlocked", () => {
    // Simulate the calculation from App.tsx
    const baseXp = 50; // 10 cards * 5 XP
    const wisdomXp = 750;
    const xpGained = hasPerk(wisdomXp, "deep_focus")
      ? Math.floor(baseXp * 1.1)
      : baseXp;
    expect(xpGained).toBe(55);
  });

  it("does not apply bonus when perk is NOT unlocked", () => {
    const baseXp = 50;
    const wisdomXp = 749;
    const xpGained = hasPerk(wisdomXp, "deep_focus")
      ? Math.floor(baseXp * 1.1)
      : baseXp;
    expect(xpGained).toBe(50);
  });

  it("floors the XP result", () => {
    // 3 cards * 5 = 15, * 1.1 = 16.5, floor = 16
    const baseXp = 15;
    const wisdomXp = 750;
    const xpGained = hasPerk(wisdomXp, "deep_focus")
      ? Math.floor(baseXp * 1.1)
      : baseXp;
    expect(xpGained).toBe(16);
  });
});
