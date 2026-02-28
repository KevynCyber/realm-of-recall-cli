import { describe, it, expect } from "vitest";
import { getEnemyTier, generateEnemy } from "../../src/core/combat/EnemyGenerator.js";
import { EnemyTier } from "../../src/types/combat.js";

describe("getEnemyTier", () => {
  it("returns Minion for difficulty < 3", () => {
    expect(getEnemyTier(2.9)).toBe(EnemyTier.Minion);
    expect(getEnemyTier(0)).toBe(EnemyTier.Minion);
    expect(getEnemyTier(1)).toBe(EnemyTier.Minion);
  });

  it("returns Common for difficulty >= 3 and < 5", () => {
    expect(getEnemyTier(3)).toBe(EnemyTier.Common);
    expect(getEnemyTier(4.9)).toBe(EnemyTier.Common);
  });

  it("returns Elite for difficulty >= 5 and < 7", () => {
    expect(getEnemyTier(5)).toBe(EnemyTier.Elite);
    expect(getEnemyTier(6.9)).toBe(EnemyTier.Elite);
  });

  it("returns Boss for difficulty >= 7", () => {
    expect(getEnemyTier(7)).toBe(EnemyTier.Boss);
    expect(getEnemyTier(10)).toBe(EnemyTier.Boss);
  });
});

describe("generateEnemy", () => {
  // rng that always returns 0 — picks first name, minimum attack
  const zeroRng = () => 0;

  it("picks name from correct pool per tier", () => {
    const minion = generateEnemy(1, 1, zeroRng);
    expect(minion.name).toBe("Slime");
    expect(minion.tier).toBe(EnemyTier.Minion);

    const common = generateEnemy(3, 1, zeroRng);
    expect(common.name).toBe("Goblin");
    expect(common.tier).toBe(EnemyTier.Common);

    const elite = generateEnemy(5, 1, zeroRng);
    expect(elite.name).toBe("Knight");
    expect(elite.tier).toBe(EnemyTier.Elite);

    const boss = generateEnemy(7, 1, zeroRng);
    expect(boss.name).toBe("Dragon");
    expect(boss.tier).toBe(EnemyTier.Boss);
  });

  it("scales HP with player level", () => {
    const lvl1 = generateEnemy(3, 1, zeroRng);
    const lvl10 = generateEnemy(3, 10, zeroRng);

    // Common tier, multiplier 1.0
    // lvl1: floor((30 + 5) * 1.0) = 35
    // lvl10: floor((30 + 50) * 1.0) = 80
    expect(lvl1.hp).toBe(35);
    expect(lvl10.hp).toBe(80);
    expect(lvl10.hp).toBeGreaterThan(lvl1.hp);
  });

  it("applies correct HP multiplier per tier", () => {
    const level = 5;
    const baseHp = 30 + level * 5; // 55

    const minion = generateEnemy(1, level, zeroRng);
    expect(minion.hp).toBe(Math.floor(baseHp * 0.5)); // 27

    const common = generateEnemy(3, level, zeroRng);
    expect(common.hp).toBe(Math.floor(baseHp * 1.0)); // 55

    const elite = generateEnemy(5, level, zeroRng);
    expect(elite.hp).toBe(Math.floor(baseHp * 1.5)); // 82

    const boss = generateEnemy(7, level, zeroRng);
    expect(boss.hp).toBe(Math.floor(baseHp * 3.0)); // 165
  });

  it("hp equals maxHp on creation", () => {
    const enemy = generateEnemy(4, 3, zeroRng);
    expect(enemy.hp).toBe(enemy.maxHp);
  });

  it("attack is within tier range", () => {
    // Minion: [5, 8]
    for (let i = 0; i < 20; i++) {
      const enemy = generateEnemy(1, 1);
      expect(enemy.attack).toBeGreaterThanOrEqual(5);
      expect(enemy.attack).toBeLessThanOrEqual(8);
    }

    // Boss: [18, 25]
    for (let i = 0; i < 20; i++) {
      const enemy = generateEnemy(8, 1);
      expect(enemy.attack).toBeGreaterThanOrEqual(18);
      expect(enemy.attack).toBeLessThanOrEqual(25);
    }
  });

  it("attack uses rng to select within range", () => {
    // rng=0 → minimum attack
    const minAtk = generateEnemy(3, 1, () => 0);
    expect(minAtk.attack).toBe(8); // Common min

    // rng just below 1 → maximum attack
    // floor(0.99 * (12 - 8 + 1)) = floor(0.99 * 5) = floor(4.95) = 4
    // 8 + 4 = 12
    const maxAtk = generateEnemy(3, 1, () => 0.99);
    expect(maxAtk.attack).toBe(12); // Common max
  });

  it("xpReward scales with player level", () => {
    const lvl1 = generateEnemy(3, 1, zeroRng);
    const lvl5 = generateEnemy(3, 5, zeroRng);

    // Common XP base = 25
    expect(lvl1.xpReward).toBe(25);
    expect(lvl5.xpReward).toBe(125);
  });

  it("goldReward scales with player level", () => {
    const lvl1 = generateEnemy(3, 1, zeroRng);
    const lvl4 = generateEnemy(3, 4, zeroRng);

    // Common gold base = 15
    // lvl1: 15 * ceil(1/2) = 15 * 1 = 15
    // lvl4: 15 * ceil(4/2) = 15 * 2 = 30
    expect(lvl1.goldReward).toBe(15);
    expect(lvl4.goldReward).toBe(30);
  });

  it("goldReward rounds up for odd levels", () => {
    // lvl3: 15 * ceil(3/2) = 15 * 2 = 30
    const lvl3 = generateEnemy(3, 3, zeroRng);
    expect(lvl3.goldReward).toBe(30);
  });
});
