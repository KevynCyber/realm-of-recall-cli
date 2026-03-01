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

/** Gold bonus multiplier for daily challenge rewards */
const DAILY_GOLD_MULTIPLIER = 2.0;
/** XP bonus multiplier for daily challenge rewards */
const DAILY_XP_MULTIPLIER = 1.5;
/** Max cards in a daily challenge */
const DAILY_CARD_COUNT = 10;
/** Enemy stat scaling constants */
const BASE_HP = 30;
const HP_PER_LEVEL = 8;
const BASE_ATTACK = 5;
const ATTACK_PER_LEVEL = 2;
const BASE_XP = 20;
const XP_PER_LEVEL = 5;
const BASE_GOLD = 15;
const GOLD_PER_LEVEL = 3;
/** Accuracy weight in scoring (out of 1000 total) */
const ACCURACY_MAX_SCORE = 500;
/** Speed weight in scoring */
const SPEED_MAX_SCORE = 300;
/** Speed time threshold in ms (responses slower than this get 0 speed score) */
const SPEED_TIME_THRESHOLD_MS = 30000;
/** Damage weight in scoring */
const DAMAGE_MAX_SCORE = 200;
/** Damage points per unit of damage dealt */
const DAMAGE_SCORE_MULTIPLIER = 2;

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

  const baseHp = BASE_HP + playerLevel * HP_PER_LEVEL;
  const baseAttack = BASE_ATTACK + playerLevel * ATTACK_PER_LEVEL;
  const baseXp = BASE_XP + playerLevel * XP_PER_LEVEL;
  const baseGold = BASE_GOLD + playerLevel * GOLD_PER_LEVEL;

  const enemy: Enemy = {
    name: enemyName,
    tier: EnemyTier.Elite,
    hp: baseHp,
    maxHp: baseHp,
    attack: baseAttack,
    xpReward: baseXp,
    goldReward: baseGold,
  };

  const cardCount = Math.min(DAILY_CARD_COUNT, allCards.length);
  const shuffled = [...allCards];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const cardIds = shuffled.slice(0, cardCount).map((c) => c.id);

  return {
    enemy,
    cardIds,
    bonusGoldMultiplier: DAILY_GOLD_MULTIPLIER,
    bonusXpMultiplier: DAILY_XP_MULTIPLIER,
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
    totalCards > 0 ? Math.round((correctCount / totalCards) * ACCURACY_MAX_SCORE) : 0;

  const speedFactor = Math.max(0, 1 - avgResponseTimeMs / SPEED_TIME_THRESHOLD_MS);
  const speedScore = Math.round(speedFactor * SPEED_MAX_SCORE);

  const damageScore = Math.min(DAMAGE_MAX_SCORE, Math.round(totalDamageDealt * DAMAGE_SCORE_MULTIPLIER));

  return {
    total: accuracyScore + speedScore + damageScore,
    accuracyScore,
    speedScore,
    damageScore,
  };
}
