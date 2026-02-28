import type { Card, Enemy } from "../../types/index.js";
import { EnemyTier } from "../../types/index.js";

/**
 * Mulberry32 seeded PRNG - deterministic random number generator.
 */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert a date string to a numeric seed.
 */
function dateToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

/**
 * Get today's daily challenge seed (YYYY-MM-DD format).
 */
export function getDailySeed(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface DailyChallengeConfig {
  enemy: Enemy;
  cardIds: string[];
  bonusGoldMultiplier: number;
  bonusXpMultiplier: number;
}

const CHALLENGE_ENEMY_NAMES = [
  "Daily Guardian",
  "Challenge Sentinel",
  "Trial Keeper",
  "Test Champion",
  "Quiz Master",
  "Memory Warden",
  "Recall Phoenix",
  "Knowledge Golem",
  "Riddle Sphinx",
  "Enigma Dragon",
];

/**
 * Generate a daily challenge with deterministic enemy and card selection.
 */
export function generateDailyChallenge(
  seed: string,
  allCards: Card[],
  playerLevel: number,
): DailyChallengeConfig {
  const rng = mulberry32(dateToSeed(seed));

  const nameIndex = Math.floor(rng() * CHALLENGE_ENEMY_NAMES.length);
  const enemyName = CHALLENGE_ENEMY_NAMES[nameIndex];

  const baseHp = 30 + playerLevel * 8;
  const baseAttack = 5 + playerLevel * 2;
  const baseXp = 20 + playerLevel * 5;
  const baseGold = 15 + playerLevel * 3;

  const enemy: Enemy = {
    name: enemyName,
    tier: EnemyTier.Elite,
    hp: baseHp,
    maxHp: baseHp,
    attack: baseAttack,
    xpReward: baseXp,
    goldReward: baseGold,
  };

  const cardCount = Math.min(10, allCards.length);
  const shuffled = [...allCards];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const cardIds = shuffled.slice(0, cardCount).map((c) => c.id);

  return {
    enemy,
    cardIds,
    bonusGoldMultiplier: 2.0,
    bonusXpMultiplier: 1.5,
  };
}

export interface DailyChallengeScore {
  total: number;
  accuracyScore: number;
  speedScore: number;
  damageScore: number;
}

/**
 * Score a daily challenge based on accuracy, speed, and damage dealt.
 */
export function scoreDailyChallenge(
  correctCount: number,
  totalCards: number,
  avgResponseTimeMs: number,
  totalDamageDealt: number,
): DailyChallengeScore {
  const accuracyScore =
    totalCards > 0 ? Math.round((correctCount / totalCards) * 500) : 0;

  const speedFactor = Math.max(0, 1 - avgResponseTimeMs / 30000);
  const speedScore = Math.round(speedFactor * 300);

  const damageScore = Math.min(200, Math.round(totalDamageDealt * 2));

  return {
    total: accuracyScore + speedScore + damageScore,
    accuracyScore,
    speedScore,
    damageScore,
  };
}
