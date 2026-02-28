// CombatEngine — resolves combat turns based on flashcard answer quality

import type { Enemy, CombatEvent, CombatAction } from "../../types/combat.js";
import { AnswerQuality } from "../../types/index.js";
import { calculateCombatXP, calculateGoldReward } from "../progression/XPCalculator.js";

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
): { newState: CombatState; event: CombatEvent } {
  // Deep copy state
  const newState: CombatState = {
    ...state,
    enemy: { ...state.enemy },
    events: [...state.events],
    stats: { ...state.stats },
  };

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
      const isCrit = rng() < critChance / 100;
      if (isCrit) {
        damage = Math.floor(playerAttack * 2.5);
        action = "player_critical";
      } else {
        damage = playerAttack * 2;
        action = "player_attack";
      }
      newState.enemy.hp -= damage;
      newState.stats.perfectCount++;
      break;
    }
    case AnswerQuality.Correct: {
      damage = playerAttack;
      action = "player_attack";
      newState.enemy.hp -= damage;
      newState.stats.correctCount++;
      break;
    }
    case AnswerQuality.Partial: {
      damage = Math.floor(playerAttack * 0.5);
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
): { xp: number; gold: number } {
  const xp = calculateCombatXP(enemy.xpReward, state.stats, streakBonusPct, 0, classXpBonusPct);
  const gold = calculateGoldReward(enemy.goldReward, classGoldBonusPct);
  return { xp, gold };
}
