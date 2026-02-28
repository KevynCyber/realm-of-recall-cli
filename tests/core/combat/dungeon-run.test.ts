import { describe, it, expect } from "vitest";
import {
  createDungeonRun,
  getCurrentFloorConfig,
  scaleEnemyForFloor,
  completeFloor,
  recordDefeat,
  retreat,
  calculateFinalRewards,
  isRunOver,
  shouldTriggerEvent,
} from "../../../src/core/combat/DungeonRun.js";
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

describe("createDungeonRun", () => {
  it("initializes with correct defaults", () => {
    const run = createDungeonRun(100, 100);
    expect(run.currentFloor).toBe(1);
    expect(run.maxFloors).toBe(5);
    expect(run.playerHp).toBe(100);
    expect(run.playerMaxHp).toBe(100);
    expect(run.totalGoldEarned).toBe(0);
    expect(run.totalXpEarned).toBe(0);
    expect(run.floorsCompleted).toBe(0);
    expect(run.retreated).toBe(false);
    expect(run.defeated).toBe(false);
    expect(run.completed).toBe(false);
  });

  it("uses provided HP values", () => {
    const run = createDungeonRun(80, 100);
    expect(run.playerHp).toBe(80);
    expect(run.playerMaxHp).toBe(100);
  });
});

describe("getCurrentFloorConfig", () => {
  it("floor 1: 1.0x multipliers, not boss", () => {
    const run = createDungeonRun(100, 100);
    const config = getCurrentFloorConfig(run);
    expect(config.floor).toBe(1);
    expect(config.enemyHpMultiplier).toBe(1.0);
    expect(config.rewardMultiplier).toBe(1.0);
    expect(config.isBoss).toBe(false);
  });

  it("floor 5: 3.0x multipliers, is boss", () => {
    let run = createDungeonRun(100, 100);
    for (let i = 0; i < 4; i++) {
      run = completeFloor(run, 10, 10, 90);
    }
    const config = getCurrentFloorConfig(run);
    expect(config.floor).toBe(5);
    expect(config.enemyHpMultiplier).toBe(3.0);
    expect(config.rewardMultiplier).toBe(3.0);
    expect(config.isBoss).toBe(true);
  });

  it("clamps to last config for floors beyond 5", () => {
    const run = { ...createDungeonRun(100, 100), currentFloor: 10 };
    const config = getCurrentFloorConfig(run);
    expect(config.isBoss).toBe(true);
    expect(config.enemyHpMultiplier).toBe(3.0);
  });
});

describe("scaleEnemyForFloor", () => {
  it("applies HP multiplier", () => {
    const enemy = makeEnemy({ hp: 100, maxHp: 100 });
    const config = { floor: 2, enemyHpMultiplier: 1.5, rewardMultiplier: 1.0, isBoss: false };
    const scaled = scaleEnemyForFloor(enemy, config);
    expect(scaled.hp).toBe(150);
    expect(scaled.maxHp).toBe(150);
  });

  it("applies reward multiplier", () => {
    const enemy = makeEnemy({ xpReward: 50, goldReward: 20 });
    const config = { floor: 3, enemyHpMultiplier: 1.0, rewardMultiplier: 2.0, isBoss: false };
    const scaled = scaleEnemyForFloor(enemy, config);
    expect(scaled.xpReward).toBe(100);
    expect(scaled.goldReward).toBe(40);
  });

  it("sets boss tier on boss floors", () => {
    const enemy = makeEnemy({ tier: EnemyTier.Common });
    const config = { floor: 5, enemyHpMultiplier: 3.0, rewardMultiplier: 3.0, isBoss: true };
    const scaled = scaleEnemyForFloor(enemy, config);
    expect(scaled.tier).toBe(EnemyTier.Boss);
  });

  it("preserves original tier on non-boss floors", () => {
    const enemy = makeEnemy({ tier: EnemyTier.Elite });
    const config = { floor: 2, enemyHpMultiplier: 1.2, rewardMultiplier: 1.25, isBoss: false };
    const scaled = scaleEnemyForFloor(enemy, config);
    expect(scaled.tier).toBe(EnemyTier.Elite);
  });

  it("rounds HP up with Math.ceil", () => {
    const enemy = makeEnemy({ hp: 10, maxHp: 10 });
    const config = { floor: 2, enemyHpMultiplier: 1.5, rewardMultiplier: 1.0, isBoss: false };
    const scaled = scaleEnemyForFloor(enemy, config);
    expect(scaled.hp).toBe(15);
  });
});

describe("completeFloor", () => {
  it("accumulates gold and XP", () => {
    let run = createDungeonRun(100, 100);
    run = completeFloor(run, 20, 50, 90);
    expect(run.totalGoldEarned).toBe(20);
    expect(run.totalXpEarned).toBe(50);
  });

  it("advances to next floor", () => {
    let run = createDungeonRun(100, 100);
    run = completeFloor(run, 10, 10, 90);
    expect(run.currentFloor).toBe(2);
    expect(run.floorsCompleted).toBe(1);
  });

  it("updates player HP", () => {
    let run = createDungeonRun(100, 100);
    run = completeFloor(run, 10, 10, 75);
    expect(run.playerHp).toBe(75);
  });

  it("marks completed after all floors done", () => {
    let run = createDungeonRun(100, 100);
    for (let i = 0; i < 5; i++) {
      run = completeFloor(run, 10, 10, 90);
    }
    expect(run.completed).toBe(true);
    expect(run.floorsCompleted).toBe(5);
  });

  it("does not advance floor after completion", () => {
    let run = createDungeonRun(100, 100);
    for (let i = 0; i < 5; i++) {
      run = completeFloor(run, 10, 10, 90);
    }
    // Floor stays at 5 (last completed), completed flag is true
    expect(run.completed).toBe(true);
  });

  it("accumulates rewards across multiple floors", () => {
    let run = createDungeonRun(100, 100);
    run = completeFloor(run, 10, 20, 90);
    run = completeFloor(run, 15, 30, 80);
    expect(run.totalGoldEarned).toBe(25);
    expect(run.totalXpEarned).toBe(50);
    expect(run.floorsCompleted).toBe(2);
  });
});

describe("recordDefeat", () => {
  it("sets defeated flag and HP to 0", () => {
    let run = createDungeonRun(100, 100);
    run = recordDefeat(run);
    expect(run.defeated).toBe(true);
    expect(run.playerHp).toBe(0);
  });

  it("preserves earned rewards", () => {
    let run = createDungeonRun(100, 100);
    run = completeFloor(run, 20, 30, 50);
    run = recordDefeat(run);
    expect(run.totalGoldEarned).toBe(20);
    expect(run.totalXpEarned).toBe(30);
  });
});

describe("retreat", () => {
  it("sets retreated flag", () => {
    let run = createDungeonRun(100, 100);
    run = retreat(run);
    expect(run.retreated).toBe(true);
  });

  it("preserves HP and rewards", () => {
    let run = createDungeonRun(100, 100);
    run = completeFloor(run, 20, 30, 75);
    run = retreat(run);
    expect(run.playerHp).toBe(75);
    expect(run.totalGoldEarned).toBe(20);
  });
});

describe("calculateFinalRewards", () => {
  it("completed run: 2x multiplier", () => {
    let run = createDungeonRun(100, 100);
    for (let i = 0; i < 5; i++) {
      run = completeFloor(run, 10, 20, 90);
    }
    const rewards = calculateFinalRewards(run);
    expect(rewards.gold).toBe(100); // 50 * 2
    expect(rewards.xp).toBe(200); // 100 * 2
    expect(rewards.bonusMultiplier).toBe(2.0);
  });

  it("defeated run: 0.5x multiplier", () => {
    let run = createDungeonRun(100, 100);
    run = completeFloor(run, 20, 40, 50);
    run = recordDefeat(run);
    const rewards = calculateFinalRewards(run);
    expect(rewards.gold).toBe(10); // 20 * 0.5
    expect(rewards.xp).toBe(20); // 40 * 0.5
    expect(rewards.bonusMultiplier).toBe(0.5);
  });

  it("retreated run: 1x multiplier", () => {
    let run = createDungeonRun(100, 100);
    run = completeFloor(run, 20, 40, 50);
    run = retreat(run);
    const rewards = calculateFinalRewards(run);
    expect(rewards.gold).toBe(20);
    expect(rewards.xp).toBe(40);
    expect(rewards.bonusMultiplier).toBe(1.0);
  });

  it("no ending state: returns 0", () => {
    const run = createDungeonRun(100, 100);
    const rewards = calculateFinalRewards(run);
    expect(rewards.gold).toBe(0);
    expect(rewards.xp).toBe(0);
    expect(rewards.bonusMultiplier).toBe(0);
  });
});

describe("isRunOver", () => {
  it("returns false for fresh run", () => {
    expect(isRunOver(createDungeonRun(100, 100))).toBe(false);
  });

  it("returns true when completed", () => {
    let run = createDungeonRun(100, 100);
    for (let i = 0; i < 5; i++) {
      run = completeFloor(run, 10, 10, 90);
    }
    expect(isRunOver(run)).toBe(true);
  });

  it("returns true when defeated", () => {
    let run = createDungeonRun(100, 100);
    run = recordDefeat(run);
    expect(isRunOver(run)).toBe(true);
  });

  it("returns true when retreated", () => {
    let run = createDungeonRun(100, 100);
    run = retreat(run);
    expect(isRunOver(run)).toBe(true);
  });
});

describe("shouldTriggerEvent", () => {
  it("triggers when rng < 0.3", () => {
    expect(shouldTriggerEvent(() => 0.1)).toBe(true);
    expect(shouldTriggerEvent(() => 0.29)).toBe(true);
  });

  it("does not trigger when rng >= 0.3", () => {
    expect(shouldTriggerEvent(() => 0.3)).toBe(false);
    expect(shouldTriggerEvent(() => 0.5)).toBe(false);
    expect(shouldTriggerEvent(() => 1.0)).toBe(false);
  });
});
