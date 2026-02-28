import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  checkNewAchievements,
  getAchievementsByCategory,
} from "../../../src/core/progression/Achievements.js";
import type { AchievementState } from "../../../src/core/progression/Achievements.js";
import { PlayerClass } from "../../../src/types/index.js";

function makeState(overrides: Partial<AchievementState> = {}): AchievementState {
  return {
    player: {
      id: 1,
      name: "TestPlayer",
      class: PlayerClass.Scholar,
      level: 1,
      xp: 0,
      hp: 100,
      maxHp: 100,
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
      createdAt: "2024-01-01",
    },
    totalMasteredCards: 0,
    totalCards: 0,
    perfectStreak: 0,
    zonesCleared: 0,
    totalZones: 0,
    decksOwned: 0,
    ...overrides,
  };
}

describe("ACHIEVEMENTS", () => {
  it("has at least 20 achievements", () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20);
  });

  it("has unique keys", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("checkNewAchievements", () => {
  it("returns empty when no conditions are met", () => {
    const state = makeState();
    const result = checkNewAchievements(state, new Set());
    expect(result).toEqual([]);
  });

  it("returns first_recall when totalReviews >= 1", () => {
    const state = makeState({
      player: { ...makeState().player, totalReviews: 1 },
    });
    const result = checkNewAchievements(state, new Set());
    const keys = result.map((a) => a.key);
    expect(keys).toContain("first_recall");
  });

  it("excludes already-unlocked achievements", () => {
    const state = makeState({
      player: { ...makeState().player, totalReviews: 1 },
    });
    const unlocked = new Set(["first_recall"]);
    const result = checkNewAchievements(state, unlocked);
    const keys = result.map((a) => a.key);
    expect(keys).not.toContain("first_recall");
  });

  it("returns century_scholar at exactly 100 reviews", () => {
    const state = makeState({
      player: { ...makeState().player, totalReviews: 100 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("century_scholar");
  });

  it("does not return century_scholar at 99 reviews", () => {
    const state = makeState({
      player: { ...makeState().player, totalReviews: 99 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).not.toContain("century_scholar");
  });

  it("returns perfect_ten with 10+ perfect streak", () => {
    const state = makeState({ perfectStreak: 10 });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("perfect_ten");
  });

  it("returns card_scholar with 10+ mastered cards", () => {
    const state = makeState({ totalMasteredCards: 10 });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("card_scholar");
  });

  it("returns accuracy_ace at 90% with reviews", () => {
    const state = makeState({
      player: { ...makeState().player, totalReviews: 100, totalCorrect: 90 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("accuracy_ace");
  });

  it("does not return accuracy_ace at 89%", () => {
    const state = makeState({
      player: { ...makeState().player, totalReviews: 100, totalCorrect: 89 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).not.toContain("accuracy_ace");
  });

  it("does not return accuracy_ace with zero reviews", () => {
    const state = makeState({
      player: { ...makeState().player, totalReviews: 0, totalCorrect: 0 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).not.toContain("accuracy_ace");
  });

  it("returns undefeated with 10+ wins and 0 losses", () => {
    const state = makeState({
      player: { ...makeState().player, combatWins: 10, combatLosses: 0 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("undefeated");
  });

  it("does not return undefeated with 1 loss", () => {
    const state = makeState({
      player: { ...makeState().player, combatWins: 10, combatLosses: 1 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).not.toContain("undefeated");
  });

  it("returns gold_hoarder at 1000+ gold", () => {
    const state = makeState({
      player: { ...makeState().player, gold: 1000 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("gold_hoarder");
  });

  it("returns streak_7 with 7+ streak days", () => {
    const state = makeState({
      player: { ...makeState().player, streakDays: 7 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("streak_7");
  });

  it("returns streak_100 using longestStreak", () => {
    const state = makeState({
      player: { ...makeState().player, longestStreak: 100 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("streak_100");
  });

  it("returns wise_one at 500+ wisdomXp", () => {
    const state = makeState({
      player: { ...makeState().player, wisdomXp: 500 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("wise_one");
  });

  it("returns explorer with 3+ decks", () => {
    const state = makeState({ decksOwned: 3 });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("explorer");
  });

  it("returns world_clear when all zones cleared", () => {
    const state = makeState({ zonesCleared: 5, totalZones: 5 });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("world_clear");
  });

  it("does not return world_clear with 0 total zones", () => {
    const state = makeState({ zonesCleared: 0, totalZones: 0 });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).not.toContain("world_clear");
  });

  it("returns ascended at ascension 1+", () => {
    const state = makeState({
      player: { ...makeState().player, ascensionLevel: 1 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("ascended");
  });

  it("returns ascension_5 at ascension 5+", () => {
    const state = makeState({
      player: { ...makeState().player, ascensionLevel: 5 },
    });
    const keys = checkNewAchievements(state, new Set()).map((a) => a.key);
    expect(keys).toContain("ascension_5");
  });

  it("returns multiple achievements simultaneously", () => {
    const state = makeState({
      player: {
        ...makeState().player,
        totalReviews: 1,
        combatWins: 1,
        level: 5,
      },
    });
    const result = checkNewAchievements(state, new Set());
    expect(result.length).toBeGreaterThan(1);
  });
});

describe("getAchievementsByCategory", () => {
  it("returns learning achievements", () => {
    const learning = getAchievementsByCategory("learning");
    expect(learning.length).toBeGreaterThan(0);
    expect(learning.every((a) => a.category === "learning")).toBe(true);
  });

  it("returns combat achievements", () => {
    const combat = getAchievementsByCategory("combat");
    expect(combat.length).toBeGreaterThan(0);
    expect(combat.every((a) => a.category === "combat")).toBe(true);
  });

  it("returns progression achievements", () => {
    const prog = getAchievementsByCategory("progression");
    expect(prog.length).toBeGreaterThan(0);
    expect(prog.every((a) => a.category === "progression")).toBe(true);
  });

  it("returns exploration achievements", () => {
    const expl = getAchievementsByCategory("exploration");
    expect(expl.length).toBeGreaterThan(0);
    expect(expl.every((a) => a.category === "exploration")).toBe(true);
  });

  it("all categories combined equal total achievements", () => {
    const all = [
      ...getAchievementsByCategory("learning"),
      ...getAchievementsByCategory("combat"),
      ...getAchievementsByCategory("progression"),
      ...getAchievementsByCategory("exploration"),
    ];
    expect(all.length).toBe(ACHIEVEMENTS.length);
  });
});
