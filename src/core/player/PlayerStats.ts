import { PlayerClass, type Player, type Equipment } from "../../types/index.js";
import { CLASS_CONFIGS } from "./ClassDefinitions.js";
import { getAggregatedEffects } from "../progression/SkillTree.js";
import type { SkillAllocation } from "../progression/SkillTree.js";

export interface EffectiveStats {
  maxHp: number;
  attack: number;
  defense: number;
  xpBonusPct: number;
  goldBonusPct: number;
  critChancePct: number;
}

/**
 * Compute effective stats from class base + level bonuses + equipment + skill tree.
 *
 * Level bonuses (per level beyond 1):
 *   +5 maxHp, +2 attack, +1 defense
 */
export function getEffectiveStats(
  player: Player,
  equippedItems: Equipment[],
  skillAllocation?: SkillAllocation,
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

  // Apply skill tree bonuses (percentage-based)
  if (skillAllocation) {
    const effects = getAggregatedEffects(skillAllocation);
    const hpBonus = effects.get("combat_hp_bonus") ?? 0;
    const atkBonus = effects.get("combat_attack_bonus") ?? 0;
    const critBonus = effects.get("combat_crit_bonus") ?? 0;
    const goldSkillBonus = effects.get("gold_bonus") ?? 0;

    maxHp = Math.floor(maxHp * (1 + hpBonus / 100));
    attack = Math.floor(attack * (1 + atkBonus / 100));
    critChancePct += critBonus;
    goldBonusPct += goldSkillBonus;
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
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}
