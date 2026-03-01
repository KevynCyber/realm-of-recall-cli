import { describe, it, expect } from "vitest";
import {
  createDungeonRun,
  getCurrentFloorConfig,
  scaleEnemyForFloor,
  completeFloor,
  recordDefeat,
  isRunOver,
  calculateFinalRewards,
} from "../../../src/core/combat/DungeonRun.js";
import type { DungeonRunState, FloorConfig } from "../../../src/core/combat/DungeonRun.js";
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

describe("Dungeon-combat integration: floor enemy scaling", () => {
  it("floor 1 enemy has base HP (1.0x multiplier)", () => {
    const run = createDungeonRun(100, 100);
    const floorConfig = getCurrentFloorConfig(run);
    const enemy = makeEnemy({ hp: 80, maxHp: 80 });
    const scaled = scaleEnemyForFloor(enemy, floorConfig);
    expect(scaled.hp).toBe(80); // 80 * 1.0 = 80
    expect(scaled.maxHp).toBe(80);
    expect(floorConfig.enemyHpMultiplier).toBe(1.0);
  });

  it("floor 3 enemy HP is scaled by 1.5x", () => {
    let run = createDungeonRun(100, 100);
    run = completeFloor(run, 10, 15, 90);
    run = completeFloor(run, 10, 15, 80);
    expect(run.currentFloor).toBe(3);
    const floorConfig = getCurrentFloorConfig(run);
    const enemy = makeEnemy({ hp: 100, maxHp: 100 });
    const scaled = scaleEnemyForFloor(enemy, floorConfig);
    expect(scaled.hp).toBe(150); // 100 * 1.5
    expect(scaled.maxHp).toBe(150);
    expect(floorConfig.enemyHpMultiplier).toBe(1.5);
  });

  it("floor 5 boss enemy HP is scaled by 3.0x with Boss tier", () => {
    let run = createDungeonRun(100, 100);
    for (let i = 0; i < 4; i++) {
      run = completeFloor(run, 10, 15, 90);
    }
    expect(run.currentFloor).toBe(5);
    const floorConfig = getCurrentFloorConfig(run);
    const enemy = makeEnemy({ hp: 100, maxHp: 100, tier: EnemyTier.Common });
    const scaled = scaleEnemyForFloor(enemy, floorConfig);
    expect(scaled.hp).toBe(300); // 100 * 3.0
    expect(scaled.maxHp).toBe(300);
    expect(scaled.tier).toBe(EnemyTier.Boss);
    expect(floorConfig.isBoss).toBe(true);
  });

  it("reward multipliers scale with floor", () => {
    let run = createDungeonRun(100, 100);
    // Floor 1: 1.0x
    expect(getCurrentFloorConfig(run).rewardMultiplier).toBe(1.0);
    run = completeFloor(run, 10, 15, 90);
    // Floor 2: 1.25x
    expect(getCurrentFloorConfig(run).rewardMultiplier).toBe(1.25);
    run = completeFloor(run, 10, 15, 80);
    // Floor 3: 1.5x
    expect(getCurrentFloorConfig(run).rewardMultiplier).toBe(1.5);
    run = completeFloor(run, 10, 15, 70);
    // Floor 4: 2.0x
    expect(getCurrentFloorConfig(run).rewardMultiplier).toBe(2.0);
    run = completeFloor(run, 10, 15, 60);
    // Floor 5: 3.0x
    expect(getCurrentFloorConfig(run).rewardMultiplier).toBe(3.0);
  });
});

describe("Dungeon-combat integration: HP persistence across floors", () => {
  it("player HP carries over between floors", () => {
    let run = createDungeonRun(100, 100);
    expect(run.playerHp).toBe(100);

    // After floor 1 combat, player has 80 HP remaining
    run = completeFloor(run, 20, 30, 80);
    expect(run.playerHp).toBe(80);
    expect(run.currentFloor).toBe(2);

    // After floor 2 combat, player has 60 HP remaining
    run = completeFloor(run, 25, 35, 60);
    expect(run.playerHp).toBe(60);
    expect(run.currentFloor).toBe(3);

    // After floor 3 combat, player has 40 HP remaining
    run = completeFloor(run, 30, 40, 40);
    expect(run.playerHp).toBe(40);
    expect(run.currentFloor).toBe(4);
  });

  it("player HP from dungeon state is independent of initial HP", () => {
    // Start with 75/100 HP
    const run = createDungeonRun(75, 100);
    expect(run.playerHp).toBe(75);
    expect(run.playerMaxHp).toBe(100);

    // After combat, HP can go up or down from starting value
    const updated = completeFloor(run, 10, 15, 50);
    expect(updated.playerHp).toBe(50);
  });
});

describe("Dungeon-combat integration: combat result routing", () => {
  it("victory result advances to next floor with rewards", () => {
    const run = createDungeonRun(100, 100);

    // Simulate a combat victory result
    const combatResult = {
      victory: true,
      goldEarned: 25,
      xpEarned: 40,
      hpRemaining: 85,
    };

    const updated = completeFloor(
      run,
      combatResult.goldEarned,
      combatResult.xpEarned,
      combatResult.hpRemaining,
    );

    expect(updated.currentFloor).toBe(2);
    expect(updated.floorsCompleted).toBe(1);
    expect(updated.totalGoldEarned).toBe(25);
    expect(updated.totalXpEarned).toBe(40);
    expect(updated.playerHp).toBe(85);
    expect(isRunOver(updated)).toBe(false);
  });

  it("defeat result marks run as over", () => {
    const run = createDungeonRun(100, 100);

    // Simulate a combat defeat result
    const updated = recordDefeat(run);

    expect(updated.defeated).toBe(true);
    expect(updated.playerHp).toBe(0);
    expect(isRunOver(updated)).toBe(true);
  });

  it("completing all 5 floors marks the run as completed with 2x bonus", () => {
    let run = createDungeonRun(100, 100);

    // Simulate winning all 5 floors with real combat results
    const floorResults = [
      { gold: 20, xp: 30, hpRemaining: 90 },
      { gold: 25, xp: 38, hpRemaining: 80 },
      { gold: 30, xp: 45, hpRemaining: 65 },
      { gold: 40, xp: 60, hpRemaining: 50 },
      { gold: 60, xp: 90, hpRemaining: 30 },
    ];

    for (const result of floorResults) {
      run = completeFloor(run, result.gold, result.xp, result.hpRemaining);
    }

    expect(run.completed).toBe(true);
    expect(run.floorsCompleted).toBe(5);
    expect(run.playerHp).toBe(30); // HP persisted from last floor

    const rewards = calculateFinalRewards(run);
    const totalGold = 20 + 25 + 30 + 40 + 60;
    const totalXp = 30 + 38 + 45 + 60 + 90;
    expect(rewards.gold).toBe(totalGold * 2); // 2x completion bonus
    expect(rewards.xp).toBe(totalXp * 2);
    expect(rewards.bonusMultiplier).toBe(2.0);
  });

  it("defeat after some floors gives 0.5x bonus on earned rewards", () => {
    let run = createDungeonRun(100, 100);

    // Complete 2 floors, then get defeated on floor 3
    run = completeFloor(run, 20, 30, 80);
    run = completeFloor(run, 25, 35, 60);
    run = recordDefeat(run);

    expect(run.defeated).toBe(true);
    expect(run.floorsCompleted).toBe(2);

    const rewards = calculateFinalRewards(run);
    expect(rewards.gold).toBe(Math.floor(45 * 0.5)); // (20 + 25) * 0.5
    expect(rewards.xp).toBe(Math.floor(65 * 0.5));   // (30 + 35) * 0.5
    expect(rewards.bonusMultiplier).toBe(0.5);
  });
});

describe("Dungeon-combat integration: floor config for combat setup", () => {
  it("getCurrentFloorConfig returns correct config for each floor number", () => {
    const configs: Array<{ floor: number; hpMult: number; rewardMult: number; boss: boolean }> = [
      { floor: 1, hpMult: 1.0, rewardMult: 1.0, boss: false },
      { floor: 2, hpMult: 1.2, rewardMult: 1.25, boss: false },
      { floor: 3, hpMult: 1.5, rewardMult: 1.5, boss: false },
      { floor: 4, hpMult: 2.0, rewardMult: 2.0, boss: false },
      { floor: 5, hpMult: 3.0, rewardMult: 3.0, boss: true },
    ];

    let run = createDungeonRun(100, 100);
    for (const expected of configs) {
      const config = getCurrentFloorConfig(run);
      expect(config.floor).toBe(expected.floor);
      expect(config.enemyHpMultiplier).toBe(expected.hpMult);
      expect(config.rewardMultiplier).toBe(expected.rewardMult);
      expect(config.isBoss).toBe(expected.boss);

      if (expected.floor < 5) {
        run = completeFloor(run, 10, 15, 90);
      }
    }
  });

  it("temporary run state trick works for getting floor config", () => {
    // This mirrors how App.tsx creates a temp run to get the floor config
    // when the DungeonRunScreen triggers onFloorCombat
    const playerHp = 80;
    const playerMaxHp = 100;
    const floorNumber = 3;

    const tempRun = { ...createDungeonRun(playerHp, playerMaxHp), currentFloor: floorNumber };
    const config = getCurrentFloorConfig(tempRun);

    expect(config.floor).toBe(3);
    expect(config.enemyHpMultiplier).toBe(1.5);
    expect(config.rewardMultiplier).toBe(1.5);
    expect(config.isBoss).toBe(false);
  });

  it("enemy scaling + combat result flow end-to-end", () => {
    let run = createDungeonRun(100, 100);

    // For each floor, get config, scale enemy, simulate result
    for (let floor = 1; floor <= 5; floor++) {
      const config = getCurrentFloorConfig(run);
      const baseEnemy = makeEnemy({ hp: 50, maxHp: 50, xpReward: 30, goldReward: 15 });
      const scaledEnemy = scaleEnemyForFloor(baseEnemy, config);

      // Verify enemy is scaled for this floor
      expect(scaledEnemy.hp).toBe(Math.ceil(50 * config.enemyHpMultiplier));
      expect(scaledEnemy.xpReward).toBe(Math.ceil(30 * config.rewardMultiplier));
      expect(scaledEnemy.goldReward).toBe(Math.ceil(15 * config.rewardMultiplier));

      // Simulate combat victory with some HP loss
      const hpLoss = 10 + floor * 5;
      const hpRemaining = Math.max(1, run.playerHp - hpLoss);
      run = completeFloor(run, scaledEnemy.goldReward, scaledEnemy.xpReward, hpRemaining);
    }

    expect(run.completed).toBe(true);
    expect(run.floorsCompleted).toBe(5);
    // HP decreased across floors
    expect(run.playerHp).toBeLessThan(100);
  });
});
