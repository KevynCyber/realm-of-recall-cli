import type { Enemy } from "../../types/index.js";
import { EnemyTier } from "../../types/index.js";

export interface DungeonRunState {
  currentFloor: number;
  maxFloors: number;
  playerHp: number;
  playerMaxHp: number;
  totalGoldEarned: number;
  totalXpEarned: number;
  floorsCompleted: number;
  retreated: boolean;
  defeated: boolean;
  completed: boolean;
}

export interface FloorConfig {
  floor: number;
  enemyHpMultiplier: number;
  rewardMultiplier: number;
  isBoss: boolean;
}

const FLOOR_CONFIGS: FloorConfig[] = [
  { floor: 1, enemyHpMultiplier: 1.0, rewardMultiplier: 1.0, isBoss: false },
  { floor: 2, enemyHpMultiplier: 1.2, rewardMultiplier: 1.25, isBoss: false },
  { floor: 3, enemyHpMultiplier: 1.5, rewardMultiplier: 1.5, isBoss: false },
  { floor: 4, enemyHpMultiplier: 2.0, rewardMultiplier: 2.0, isBoss: false },
  { floor: 5, enemyHpMultiplier: 3.0, rewardMultiplier: 3.0, isBoss: true },
];

/**
 * Create a new dungeon run.
 */
export function createDungeonRun(
  playerHp: number,
  playerMaxHp: number,
): DungeonRunState {
  return {
    currentFloor: 1,
    maxFloors: 5,
    playerHp,
    playerMaxHp,
    totalGoldEarned: 0,
    totalXpEarned: 0,
    floorsCompleted: 0,
    retreated: false,
    defeated: false,
    completed: false,
  };
}

/**
 * Get the configuration for the current floor.
 */
export function getCurrentFloorConfig(run: DungeonRunState): FloorConfig {
  const index = Math.min(run.currentFloor - 1, FLOOR_CONFIGS.length - 1);
  return FLOOR_CONFIGS[index];
}

/**
 * Scale an enemy for the current dungeon floor.
 */
export function scaleEnemyForFloor(
  baseEnemy: Enemy,
  floorConfig: FloorConfig,
): Enemy {
  const scaledHp = Math.ceil(baseEnemy.hp * floorConfig.enemyHpMultiplier);
  return {
    ...baseEnemy,
    hp: scaledHp,
    maxHp: scaledHp,
    tier: floorConfig.isBoss ? EnemyTier.Boss : baseEnemy.tier,
    xpReward: Math.ceil(baseEnemy.xpReward * floorConfig.rewardMultiplier),
    goldReward: Math.ceil(baseEnemy.goldReward * floorConfig.rewardMultiplier),
  };
}

/**
 * Record a floor victory and advance to the next floor.
 */
export function completeFloor(
  run: DungeonRunState,
  goldEarned: number,
  xpEarned: number,
  hpRemaining: number,
): DungeonRunState {
  const newState = {
    ...run,
    totalGoldEarned: run.totalGoldEarned + goldEarned,
    totalXpEarned: run.totalXpEarned + xpEarned,
    playerHp: hpRemaining,
    floorsCompleted: run.floorsCompleted + 1,
  };

  if (newState.floorsCompleted >= newState.maxFloors) {
    return { ...newState, completed: true };
  }

  return { ...newState, currentFloor: newState.currentFloor + 1 };
}

/**
 * Record a floor defeat (player died).
 */
export function recordDefeat(run: DungeonRunState): DungeonRunState {
  return { ...run, defeated: true, playerHp: 0 };
}

/**
 * Player retreats from the dungeon.
 */
export function retreat(run: DungeonRunState): DungeonRunState {
  return { ...run, retreated: true };
}

/**
 * Calculate final rewards based on how the run ended.
 */
export function calculateFinalRewards(run: DungeonRunState): {
  gold: number;
  xp: number;
  bonusMultiplier: number;
} {
  if (run.completed) {
    return {
      gold: run.totalGoldEarned * 2,
      xp: run.totalXpEarned * 2,
      bonusMultiplier: 2.0,
    };
  }

  if (run.defeated) {
    return {
      gold: Math.floor(run.totalGoldEarned * 0.5),
      xp: Math.floor(run.totalXpEarned * 0.5),
      bonusMultiplier: 0.5,
    };
  }

  if (run.retreated) {
    return {
      gold: run.totalGoldEarned,
      xp: run.totalXpEarned,
      bonusMultiplier: 1.0,
    };
  }

  return { gold: 0, xp: 0, bonusMultiplier: 0 };
}

/**
 * Check if the dungeon run is over.
 */
export function isRunOver(run: DungeonRunState): boolean {
  return run.completed || run.defeated || run.retreated;
}

/**
 * Check if a random event should trigger between floors (30% chance).
 */
export function shouldTriggerEvent(rng?: () => number): boolean {
  const random = rng ?? Math.random;
  return random() < 0.3;
}
