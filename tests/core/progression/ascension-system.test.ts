import { describe, it, expect } from "vitest";
import {
  getActiveModifiers,
  applyAscensionToEnemy,
  applyAscensionToCombat,
  getDefaultCombatSettings,
  canUnlockNextAscension,
  getMaxAscensionLevel,
} from "../../../src/core/progression/AscensionSystem.js";
import { EnemyTier } from "../../../src/types/index.js";
import type { Enemy } from "../../../src/types/index.js";

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    name: "Goblin",
    tier: EnemyTier.Common,
    hp: 100,
    maxHp: 100,
    attack: 10,
    xpReward: 50,
    goldReward: 20,
    ...overrides,
  };
}

describe("getActiveModifiers", () => {
  it("returns empty array for level 0", () => {
    expect(getActiveModifiers(0)).toEqual([]);
  });

  it("returns 1 modifier for level 1", () => {
    const mods = getActiveModifiers(1);
    expect(mods).toHaveLength(1);
    expect(mods[0].name).toBe("Hardened Foes");
  });

  it("returns cumulative modifiers", () => {
    const mods = getActiveModifiers(5);
    expect(mods).toHaveLength(5);
  });

  it("returns all 10 modifiers at level 10", () => {
    const mods = getActiveModifiers(10);
    expect(mods).toHaveLength(10);
  });

  it("caps at 10 even for higher levels", () => {
    const mods = getActiveModifiers(15);
    expect(mods).toHaveLength(10);
  });
});

describe("applyAscensionToEnemy", () => {
  it("returns unmodified enemy at level 0", () => {
    const enemy = makeEnemy();
    const result = applyAscensionToEnemy(enemy, 0);
    expect(result).toEqual(enemy);
  });

  it("level 1: increases HP by 15%", () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100 });
    const result = applyAscensionToEnemy(enemy, 1);
    expect(result.hp).toBe(115);
    expect(result.maxHp).toBe(115);
    expect(result.attack).toBe(10); // unchanged
  });

  it("level 4: increases attack by 20%", () => {
    const enemy = makeEnemy({ attack: 10 });
    const result = applyAscensionToEnemy(enemy, 4);
    expect(result.attack).toBe(12);
  });

  it("level 10: adds +50% HP on top of +15%", () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100 });
    const result = applyAscensionToEnemy(enemy, 10);
    // 1 + 0.15 + 0.50 = 1.65
    expect(result.hp).toBe(165);
    expect(result.maxHp).toBe(165);
  });

  it("does not modify original enemy object", () => {
    const enemy = makeEnemy({ hp: 100 });
    applyAscensionToEnemy(enemy, 5);
    expect(enemy.hp).toBe(100);
  });

  it("rounds HP and attack up with Math.ceil", () => {
    const enemy = makeEnemy({ hp: 11, maxHp: 11, attack: 11 });
    const result = applyAscensionToEnemy(enemy, 4);
    // HP: ceil(11 * 1.15) = ceil(12.65) = 13
    expect(result.hp).toBe(13);
    // Attack: ceil(11 * 1.20) = ceil(13.2) = 14
    expect(result.attack).toBe(14);
  });
});

describe("applyAscensionToCombat", () => {
  it("returns unmodified settings at level 0", () => {
    const base = getDefaultCombatSettings();
    const result = applyAscensionToCombat(base, 0);
    expect(result).toEqual(base);
  });

  it("level 2: reduces timer by 5s", () => {
    const base = getDefaultCombatSettings();
    const result = applyAscensionToCombat(base, 2);
    expect(result.timerSeconds).toBe(25);
  });

  it("level 2: timer minimum is 10s", () => {
    const base = { ...getDefaultCombatSettings(), timerSeconds: 12 };
    const result = applyAscensionToCombat(base, 2);
    expect(result.timerSeconds).toBe(10);
  });

  it("level 3: disables partial credit", () => {
    const base = getDefaultCombatSettings();
    const result = applyAscensionToCombat(base, 3);
    expect(result.partialCreditEnabled).toBe(false);
  });

  it("level 5: sets starting HP to 80%", () => {
    const base = getDefaultCombatSettings();
    const result = applyAscensionToCombat(base, 5);
    expect(result.startingHpPercent).toBe(80);
  });

  it("level 6: halves loot drop rate", () => {
    const base = getDefaultCombatSettings();
    const result = applyAscensionToCombat(base, 6);
    expect(result.lootDropMultiplier).toBe(0.5);
  });

  it("level 7: disables hints", () => {
    const base = getDefaultCombatSettings();
    const result = applyAscensionToCombat(base, 7);
    expect(result.hintsEnabled).toBe(false);
  });

  it("level 8: adds poison damage", () => {
    const base = getDefaultCombatSettings();
    const result = applyAscensionToCombat(base, 8);
    expect(result.enemyPoisonDamage).toBe(2);
  });

  it("level 9: requires 2 consecutive correct", () => {
    const base = getDefaultCombatSettings();
    const result = applyAscensionToCombat(base, 9);
    expect(result.consecutiveCorrectRequired).toBe(2);
  });

  it("level 10: applies all modifiers cumulatively", () => {
    const base = getDefaultCombatSettings();
    const result = applyAscensionToCombat(base, 10);
    expect(result.timerSeconds).toBe(25);
    expect(result.partialCreditEnabled).toBe(false);
    expect(result.startingHpPercent).toBe(80);
    expect(result.lootDropMultiplier).toBe(0.5);
    expect(result.hintsEnabled).toBe(false);
    expect(result.enemyPoisonDamage).toBe(2);
    expect(result.consecutiveCorrectRequired).toBe(2);
  });
});

describe("getDefaultCombatSettings", () => {
  it("returns expected defaults", () => {
    const settings = getDefaultCombatSettings();
    expect(settings.timerSeconds).toBe(30);
    expect(settings.hintsEnabled).toBe(true);
    expect(settings.partialCreditEnabled).toBe(true);
    expect(settings.lootDropMultiplier).toBe(1.0);
    expect(settings.startingHpPercent).toBe(100);
    expect(settings.enemyPoisonDamage).toBe(0);
    expect(settings.consecutiveCorrectRequired).toBe(1);
  });
});

describe("canUnlockNextAscension", () => {
  it("returns false for empty zones", () => {
    expect(canUnlockNextAscension(0, [])).toBe(false);
  });

  it("returns false at max ascension (10)", () => {
    expect(canUnlockNextAscension(10, [{ bossDefeated: true }])).toBe(false);
  });

  it("returns true when all bosses defeated", () => {
    const zones = [{ bossDefeated: true }, { bossDefeated: true }];
    expect(canUnlockNextAscension(0, zones)).toBe(true);
  });

  it("returns false when not all bosses defeated", () => {
    const zones = [{ bossDefeated: true }, { bossDefeated: false }];
    expect(canUnlockNextAscension(0, zones)).toBe(false);
  });
});

describe("getMaxAscensionLevel", () => {
  it("returns 10", () => {
    expect(getMaxAscensionLevel()).toBe(10);
  });
});
