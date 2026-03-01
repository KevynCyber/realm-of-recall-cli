import { describe, it, expect } from "vitest";
import {
  xpToNextLevel,
  calculateCombatXP,
  calculateGoldReward,
} from "../../src/core/progression/XPCalculator.js";
import {
  checkLevelUp,
  applyLevelUp,
} from "../../src/core/progression/LevelSystem.js";
import { PlayerClass, type Player } from "../../src/types/index.js";

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
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// xpToNextLevel
// ---------------------------------------------------------------------------
describe("xpToNextLevel", () => {
  it("returns 100 for level 1", () => {
    expect(xpToNextLevel(1)).toBe(100);
  });

  it("returns 1118 for level 5", () => {
    expect(xpToNextLevel(5)).toBe(1118);
  });

  it("returns 3162 for level 10", () => {
    expect(xpToNextLevel(10)).toBe(3162);
  });

  it("returns 8944 for level 20", () => {
    expect(xpToNextLevel(20)).toBe(8944);
  });
});

// ---------------------------------------------------------------------------
// calculateCombatXP
// ---------------------------------------------------------------------------
describe("calculateCombatXP", () => {
  it("calculates XP with all perfect answers", () => {
    const stats = { perfectCount: 5, correctCount: 0, partialCount: 0, wrongCount: 0 };
    // qualityMultiplier = 1.5, no bonuses => 50 * 1.5 = 75
    expect(calculateCombatXP(50, stats, 0, 0, 0)).toBe(75);
  });

  it("calculates XP with mixed answers", () => {
    const stats = { perfectCount: 2, correctCount: 1, partialCount: 1, wrongCount: 1 };
    // weightedSum = 2*1.5 + 1*1.0 + 1*0.5 + 1*0.25 = 4.75
    // qualityMultiplier = 4.75 / 5 = 0.95
    // 50 * 0.95 * 1.0 = 47.5 => 47
    expect(calculateCombatXP(50, stats, 0, 0, 0)).toBe(47);
  });

  it("applies bonus percentages", () => {
    const stats = { perfectCount: 5, correctCount: 0, partialCount: 0, wrongCount: 0 };
    // qualityMultiplier = 1.5, bonuses = 10+5+15 = 30%
    // 50 * 1.5 * 1.3 = 97.5 => 97
    expect(calculateCombatXP(50, stats, 10, 5, 15)).toBe(97);
  });

  it("returns 0 when there are no answers", () => {
    const stats = { perfectCount: 0, correctCount: 0, partialCount: 0, wrongCount: 0 };
    expect(calculateCombatXP(50, stats, 0, 0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateGoldReward
// ---------------------------------------------------------------------------
describe("calculateGoldReward", () => {
  it("returns base gold with 0% bonus", () => {
    expect(calculateGoldReward(100, 0)).toBe(100);
  });

  it("applies 25% bonus", () => {
    // 100 * 1.25 = 125
    expect(calculateGoldReward(100, 25)).toBe(125);
  });
});

// ---------------------------------------------------------------------------
// checkLevelUp
// ---------------------------------------------------------------------------
describe("checkLevelUp", () => {
  it("returns false when XP is insufficient", () => {
    const player = makePlayer({ level: 1, xp: 50 });
    const result = checkLevelUp(player);
    expect(result.leveled).toBe(false);
    expect(result.newLevel).toBe(1);
    expect(result.hpGain).toBe(0);
  });

  it("returns true when XP is sufficient", () => {
    const player = makePlayer({ level: 1, xp: 100 });
    const result = checkLevelUp(player);
    expect(result.leveled).toBe(true);
    expect(result.newLevel).toBe(2);
    expect(result.hpGain).toBe(5);
    expect(result.attackGain).toBe(2);
    expect(result.defenseGain).toBe(1);
  });

  it("detects milestone at level 5", () => {
    const player = makePlayer({ level: 4, xp: xpToNextLevel(4) });
    const result = checkLevelUp(player);
    expect(result.leveled).toBe(true);
    expect(result.newLevel).toBe(5);
    expect(result.isMilestone).toBe(true);
  });

  it("detects milestone at level 10", () => {
    const player = makePlayer({ level: 9, xp: xpToNextLevel(9) });
    const result = checkLevelUp(player);
    expect(result.leveled).toBe(true);
    expect(result.newLevel).toBe(10);
    expect(result.isMilestone).toBe(true);
  });

  it("does not flag non-milestone levels", () => {
    const player = makePlayer({ level: 2, xp: xpToNextLevel(2) });
    const result = checkLevelUp(player);
    expect(result.leveled).toBe(true);
    expect(result.newLevel).toBe(3);
    expect(result.isMilestone).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyLevelUp
// ---------------------------------------------------------------------------
describe("applyLevelUp", () => {
  it("handles a single level-up", () => {
    // xpToNextLevel(1) = 100, give exactly 100
    const player = makePlayer({ level: 1, xp: 100, maxHp: 50, attack: 10, defense: 5 });
    const updated = applyLevelUp(player);
    expect(updated.level).toBe(2);
    expect(updated.xp).toBe(0);
    expect(updated.maxHp).toBe(55);
    expect(updated.attack).toBe(12);
    expect(updated.defense).toBe(6);
  });

  it("handles multi level-up when XP is enough for 2+ levels", () => {
    // xpToNextLevel(1) = 100, xpToNextLevel(2) = floor(100 * 2^1.5) = 282
    // Give 100 + 282 = 382 => should reach level 3
    const player = makePlayer({ level: 1, xp: 382, maxHp: 50, attack: 10, defense: 5 });
    const updated = applyLevelUp(player);
    expect(updated.level).toBe(3);
    expect(updated.xp).toBe(0);
    expect(updated.maxHp).toBe(60);
    expect(updated.attack).toBe(14);
    expect(updated.defense).toBe(7);
  });

  it("carries over XP overflow correctly", () => {
    // xpToNextLevel(1) = 100, give 150 => level 2 with 50 XP remaining
    const player = makePlayer({ level: 1, xp: 150, maxHp: 50, attack: 10, defense: 5 });
    const updated = applyLevelUp(player);
    expect(updated.level).toBe(2);
    expect(updated.xp).toBe(50);
    expect(updated.maxHp).toBe(55);
  });

  it("does nothing when XP is insufficient", () => {
    const player = makePlayer({ level: 1, xp: 50, maxHp: 50, attack: 10, defense: 5 });
    const updated = applyLevelUp(player);
    expect(updated.level).toBe(1);
    expect(updated.xp).toBe(50);
    expect(updated.maxHp).toBe(50);
  });

  it("heals to full maxHp on level-up", () => {
    const player = makePlayer({ level: 1, xp: 100, hp: 20, maxHp: 50, attack: 10, defense: 5 });
    const updated = applyLevelUp(player);
    expect(updated.hp).toBe(55); // new maxHp
    expect(updated.maxHp).toBe(55);
  });

  it("awards 1 skill point per level-up", () => {
    const player = makePlayer({ level: 1, xp: 100, skillPoints: 0 });
    const updated = applyLevelUp(player);
    expect(updated.skillPoints).toBe(1);
  });

  it("awards skill points for multi level-up", () => {
    const player = makePlayer({ level: 1, xp: 382, skillPoints: 2 });
    const updated = applyLevelUp(player);
    expect(updated.level).toBe(3);
    expect(updated.skillPoints).toBe(4); // 2 existing + 2 new levels
  });
});
