// Enemy generator — maps card difficulty to enemy tier and stats

import { EnemyTier, type Enemy } from "../../types/combat.js";

export const NAME_POOLS: Record<EnemyTier, string[]> = {
  [EnemyTier.Minion]: ["Slime", "Bat", "Rat", "Beetle", "Wisp"],
  [EnemyTier.Common]: ["Goblin", "Skeleton", "Spider", "Wolf", "Bandit"],
  [EnemyTier.Elite]: ["Knight", "Dark Mage", "Assassin", "Golem", "Wraith"],
  [EnemyTier.Boss]: [
    "Dragon",
    "Lich",
    "Demon Lord",
    "Ancient Wyrm",
    "Shadow King",
  ],
};

const TIER_MULTIPLIERS: Record<EnemyTier, number> = {
  [EnemyTier.Minion]: 0.5,
  [EnemyTier.Common]: 1.0,
  [EnemyTier.Elite]: 1.5,
  [EnemyTier.Boss]: 3.0,
};

const TIER_ATTACK_RANGES: Record<EnemyTier, [number, number]> = {
  [EnemyTier.Minion]: [5, 8],
  [EnemyTier.Common]: [8, 12],
  [EnemyTier.Elite]: [12, 18],
  [EnemyTier.Boss]: [18, 25],
};

const TIER_XP_BASE: Record<EnemyTier, number> = {
  [EnemyTier.Minion]: 10,
  [EnemyTier.Common]: 25,
  [EnemyTier.Elite]: 50,
  [EnemyTier.Boss]: 100,
};

const TIER_GOLD_BASE: Record<EnemyTier, number> = {
  [EnemyTier.Minion]: 5,
  [EnemyTier.Common]: 15,
  [EnemyTier.Elite]: 30,
  [EnemyTier.Boss]: 75,
};

export function getEnemyTier(difficulty: number): EnemyTier {
  if (difficulty < 3) return EnemyTier.Minion;
  if (difficulty < 5) return EnemyTier.Common;
  if (difficulty < 7) return EnemyTier.Elite;
  return EnemyTier.Boss;
}

/**
 * Generate an enemy based on card difficulty and player level.
 * An optional rng function (returning [0,1)) can be injected for deterministic tests.
 */
export function generateEnemy(
  cardDifficulty: number,
  playerLevel: number,
  rng: () => number = Math.random,
): Enemy {
  const tier = getEnemyTier(cardDifficulty);
  const pool = NAME_POOLS[tier];
  const name = pool[Math.floor(rng() * pool.length)];

  const baseHp = 30 + playerLevel * 5;
  const calculatedHp = Math.floor(baseHp * TIER_MULTIPLIERS[tier]);

  const [minAtk, maxAtk] = TIER_ATTACK_RANGES[tier];
  const attack = minAtk + Math.floor(rng() * (maxAtk - minAtk + 1));

  const xpReward = TIER_XP_BASE[tier] * playerLevel;
  const goldReward = TIER_GOLD_BASE[tier] * Math.ceil(playerLevel / 2);

  return {
    name,
    tier,
    hp: calculatedHp,
    maxHp: calculatedHp,
    attack,
    xpReward,
    goldReward,
  };
}
