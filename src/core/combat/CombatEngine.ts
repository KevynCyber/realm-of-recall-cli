// CombatEngine — resolves combat turns based on flashcard answer quality

import type { Enemy, CombatEvent, CombatAction } from "../../types/combat.js";
import { AnswerQuality, ConfidenceLevel, RetrievalMode } from "../../types/index.js";
import type { Equipment } from "../../types/index.js";
import { calculateCombatXP, calculateGoldReward } from "../progression/XPCalculator.js";
import { getTierDamageMultiplier, getTierCritBonus } from "../cards/CardEvolution.js";
import type { EvolutionTier } from "../cards/CardEvolution.js";
import { getModeDamageMultiplier } from "../review/ModeSelector.js";

// ── Special Effect Types ──────────────────────────────────────

export type SpecialEffectType =
  | "bonus_damage_on_perfect"
  | "heal_on_correct"
  | "double_crit_damage"
  | "gold_bonus_pct"
  | "unknown";

export interface ParsedSpecialEffect {
  type: SpecialEffectType;
  value: number;
  itemName: string;
  raw: string;
}

export interface SpecialEffectResult {
  bonusDamage: number;
  healAmount: number;
  doubleCrit: boolean;
  goldBonusPct: number;
  activations: string[];
}

/**
 * Parse a specialEffect string from equipment into a structured effect.
 */
export function parseSpecialEffect(effectStr: string, itemName: string): ParsedSpecialEffect {
  // 'Perfect answers deal +N bonus damage'
  const bonusDmgMatch = effectStr.match(/^Perfect answers deal \+(\d+) bonus damage$/i);
  if (bonusDmgMatch) {
    return { type: "bonus_damage_on_perfect", value: parseInt(bonusDmgMatch[1], 10), itemName, raw: effectStr };
  }

  // 'Correct answers heal N HP'
  const healMatch = effectStr.match(/^Correct answers heal (\d+) HP$/i);
  if (healMatch) {
    return { type: "heal_on_correct", value: parseInt(healMatch[1], 10), itemName, raw: effectStr };
  }

  // 'Critical hits deal double damage'
  const critMatch = effectStr.match(/^Critical hits deal double damage$/i);
  if (critMatch) {
    return { type: "double_crit_damage", value: 2, itemName, raw: effectStr };
  }

  // '+N% gold from combat'
  const goldMatch = effectStr.match(/^\+(\d+)% gold from combat$/i);
  if (goldMatch) {
    return { type: "gold_bonus_pct", value: parseInt(goldMatch[1], 10), itemName, raw: effectStr };
  }

  return { type: "unknown", value: 0, itemName, raw: effectStr };
}

/**
 * Parse all equipped items' special effects.
 */
export function parseEquipmentEffects(equippedItems: Equipment[]): ParsedSpecialEffect[] {
  const effects: ParsedSpecialEffect[] = [];
  for (const item of equippedItems) {
    if (item.specialEffect) {
      const parsed = parseSpecialEffect(item.specialEffect, item.name);
      if (parsed.type !== "unknown") {
        effects.push(parsed);
      }
    }
  }
  return effects;
}

/**
 * Apply special effects based on answer quality and combat action.
 * Returns adjustments to apply to combat state.
 */
export function applySpecialEffects(
  quality: AnswerQuality,
  action: CombatAction,
  effects: ParsedSpecialEffect[],
): SpecialEffectResult {
  const result: SpecialEffectResult = {
    bonusDamage: 0,
    healAmount: 0,
    doubleCrit: false,
    goldBonusPct: 0,
    activations: [],
  };

  for (const effect of effects) {
    switch (effect.type) {
      case "bonus_damage_on_perfect":
        if (quality === AnswerQuality.Perfect) {
          result.bonusDamage += effect.value;
          result.activations.push(`${effect.itemName} activates: +${effect.value} bonus damage!`);
        }
        break;
      case "heal_on_correct":
        if (quality === AnswerQuality.Perfect || quality === AnswerQuality.Correct) {
          result.healAmount += effect.value;
          result.activations.push(`${effect.itemName} activates: heal ${effect.value} HP!`);
        }
        break;
      case "double_crit_damage":
        if (action === "player_critical") {
          result.doubleCrit = true;
          result.activations.push(`${effect.itemName} activates: critical damage doubled!`);
        }
        break;
      case "gold_bonus_pct":
        result.goldBonusPct += effect.value;
        // Gold bonus is passive, no per-turn activation message
        break;
    }
  }

  return result;
}

export interface CombatState {
  enemy: Enemy;
  playerHp: number;
  playerMaxHp: number;
  events: CombatEvent[];
  currentCardIndex: number;
  totalCards: number;
  poisonDamage: number;
  stats: {
    perfectCount: number;
    correctCount: number;
    partialCount: number;
    wrongCount: number;
  };
}

export function createCombatState(
  enemy: Enemy,
  playerMaxHp: number,
  playerHp: number,
  cardCount: number,
): CombatState {
  return {
    enemy: { ...enemy },
    playerHp,
    playerMaxHp,
    events: [],
    currentCardIndex: 0,
    totalCards: cardCount,
    poisonDamage: 0,
    stats: {
      perfectCount: 0,
      correctCount: 0,
      partialCount: 0,
      wrongCount: 0,
    },
  };
}

export function resolveTurn(
  state: CombatState,
  answerQuality: AnswerQuality,
  playerAttack: number,
  playerDefense: number,
  critChance: number,
  rng: () => number = Math.random,
  confidence?: ConfidenceLevel,
  evolutionTier?: number,
  retrievalMode?: RetrievalMode,
  equipmentEffects?: ParsedSpecialEffect[],
): { newState: CombatState; event: CombatEvent } {
  // Deep copy state
  const newState: CombatState = {
    ...state,
    enemy: { ...state.enemy },
    events: [...state.events],
    stats: { ...state.stats },
  };

  // Calculate tier and mode multipliers
  const tierMult = getTierDamageMultiplier((evolutionTier ?? 0) as EvolutionTier);
  const modeMult = getModeDamageMultiplier(retrievalMode ?? RetrievalMode.Standard);

  // Apply poison from previous turn if present
  if (newState.poisonDamage > 0) {
    newState.playerHp -= newState.poisonDamage;
    newState.playerHp = Math.max(0, newState.playerHp);
    newState.events.push({
      action: "enemy_poison",
      damage: newState.poisonDamage,
      description: `Poison deals ${newState.poisonDamage} damage!`,
    });
    newState.poisonDamage = 0;
  }

  let action: CombatAction;
  let damage: number;

  switch (answerQuality) {
    case AnswerQuality.Perfect: {
      const baseMult = confidence === ConfidenceLevel.Instant ? 2.5
        : confidence === ConfidenceLevel.Knew ? 2.0
        : confidence === ConfidenceLevel.Guess ? 1.0
        : 2.0;
      const effectiveCrit = critChance + getTierCritBonus((evolutionTier ?? 0) as EvolutionTier);
      const isCrit = rng() < effectiveCrit / 100;
      if (isCrit) {
        damage = Math.floor(playerAttack * (baseMult + 0.5) * tierMult * modeMult);
        action = "player_critical";
      } else {
        damage = Math.floor(playerAttack * baseMult * tierMult * modeMult);
        action = confidence === ConfidenceLevel.Guess ? "player_glancing" : "player_attack";
      }
      newState.enemy.hp -= damage;
      newState.stats.perfectCount++;
      break;
    }
    case AnswerQuality.Correct: {
      const baseMult = confidence === ConfidenceLevel.Instant ? 1.5
        : confidence === ConfidenceLevel.Knew ? 1.0
        : confidence === ConfidenceLevel.Guess ? 0.5
        : 1.0;
      damage = Math.floor(playerAttack * baseMult * tierMult * modeMult);
      action = confidence === ConfidenceLevel.Guess ? "player_glancing" : "player_attack";
      newState.enemy.hp -= damage;
      newState.stats.correctCount++;
      break;
    }
    case AnswerQuality.Partial: {
      damage = Math.floor(playerAttack * 0.5 * tierMult * modeMult);
      action = "player_glancing";
      newState.enemy.hp -= damage;
      newState.stats.partialCount++;
      break;
    }
    case AnswerQuality.Wrong: {
      damage = Math.max(1, newState.enemy.attack - playerDefense);
      action = "enemy_attack";
      newState.playerHp -= damage;
      newState.stats.wrongCount++;
      break;
    }
    case AnswerQuality.Timeout: {
      damage = Math.max(1, newState.enemy.attack - playerDefense);
      action = "enemy_poison";
      newState.playerHp -= damage;
      newState.poisonDamage = 5;
      newState.stats.wrongCount++;
      break;
    }
  }

  // Apply equipment special effects
  const effects = equipmentEffects && equipmentEffects.length > 0
    ? applySpecialEffects(answerQuality, action, equipmentEffects)
    : null;

  if (effects) {
    // Double crit damage (applied before bonus damage)
    if (effects.doubleCrit && action === "player_critical") {
      newState.enemy.hp += damage; // undo original damage
      damage = damage * 2;
      newState.enemy.hp -= damage; // apply doubled damage
    }

    // Bonus damage on perfect
    if (effects.bonusDamage > 0) {
      damage += effects.bonusDamage;
      newState.enemy.hp -= effects.bonusDamage;
    }

    // Heal on correct/perfect
    if (effects.healAmount > 0) {
      newState.playerHp = Math.min(newState.playerMaxHp, newState.playerHp + effects.healAmount);
    }

    // Add activation events to combat log
    for (const activation of effects.activations) {
      newState.events.push({
        action,
        damage: 0,
        description: activation,
      });
    }
  }

  // Clamp HP to 0 minimum
  newState.enemy.hp = Math.max(0, newState.enemy.hp);
  newState.playerHp = Math.max(0, newState.playerHp);

  // Increment card index
  newState.currentCardIndex++;

  // Create event
  const event: CombatEvent = {
    action,
    damage,
    description: buildDescription(action, damage, newState.enemy.name),
  };
  newState.events.push(event);

  return { newState, event };
}

function buildDescription(action: CombatAction, damage: number, enemyName: string): string {
  switch (action) {
    case "player_critical":
      return `Critical hit! You deal ${damage} damage to ${enemyName}!`;
    case "player_attack":
      return `You deal ${damage} damage to ${enemyName}.`;
    case "player_glancing":
      return `Glancing blow! You deal ${damage} damage to ${enemyName}.`;
    case "enemy_attack":
      return `${enemyName} attacks you for ${damage} damage!`;
    case "enemy_poison":
      return `${enemyName} poisons you for ${damage} damage!`;
  }
}

export function isCombatOver(state: CombatState): { over: boolean; victory: boolean } {
  if (state.enemy.hp <= 0) {
    return { over: true, victory: true };
  }
  if (state.playerHp <= 0) {
    return { over: true, victory: false };
  }
  return { over: false, victory: false };
}

export function getCombatRewards(
  state: CombatState,
  enemy: Enemy,
  streakBonusPct: number,
  classXpBonusPct: number,
  classGoldBonusPct: number,
  equipmentEffects?: ParsedSpecialEffect[],
): { xp: number; gold: number } {
  const xp = calculateCombatXP(enemy.xpReward, state.stats, streakBonusPct, 0, classXpBonusPct);
  // Calculate equipment gold bonus from special effects
  let equipGoldBonusPct = 0;
  if (equipmentEffects) {
    for (const effect of equipmentEffects) {
      if (effect.type === "gold_bonus_pct") {
        equipGoldBonusPct += effect.value;
      }
    }
  }
  const gold = calculateGoldReward(enemy.goldReward, classGoldBonusPct + equipGoldBonusPct);
  return { xp, gold };
}
