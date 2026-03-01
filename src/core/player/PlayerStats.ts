import { PlayerClass, type Player, type Equipment } from "../../types/index.js";
import { CLASS_CONFIGS } from "./ClassDefinitions.js";

export interface EffectiveStats {
  maxHp: number;
  attack: number;
  defense: number;
  xpBonusPct: number;
  goldBonusPct: number;
  critChancePct: number;
}

/**
 * Compute effective stats from class base + level bonuses + equipment.
 *
 * Level bonuses (per level beyond 1):
 *   +5 maxHp, +2 attack, +1 defense
 */
export function getEffectiveStats(
  player: Player,
  equippedItems: Equipment[],
): EffectiveStats {
  const config = CLASS_CONFIGS[player.class];
  const levelsGained = player.level - 1;

  let maxHp = config.baseHp + levelsGained * 5;
  let attack = config.baseAttack + levelsGained * 2;
  let defense = config.baseDefense + levelsGained * 1;
  let xpBonusPct = config.xpBonusPct;
  let goldBonusPct = config.goldBonusPct;
  let critChancePct = config.critChancePct;

  for (const item of equippedItems) {
    maxHp += item.hpBonus;
    attack += item.attackBonus;
    defense += item.defenseBonus;
    xpBonusPct += item.xpBonusPct;
    goldBonusPct += item.goldBonusPct;
    critChancePct += item.critBonusPct;
  }

  return { maxHp, attack, defense, xpBonusPct, goldBonusPct, critChancePct };
}

/**
 * Create a fresh level-1 player with stats derived from their chosen class.
 */
export function createNewPlayer(name: string, playerClass: PlayerClass): Player {
  const config = CLASS_CONFIGS[playerClass];

  return {
    id: 1,
    name,
    class: playerClass,
    level: 1,
    xp: 0,
    hp: config.baseHp,
    maxHp: config.baseHp,
    attack: config.baseAttack,
    defense: config.baseDefense,
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
    desiredRetention: 0.9,
    maxNewCardsPerDay: 20,
    createdAt: new Date().toISOString(),
  };
}
