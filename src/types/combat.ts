// Combat types

import type { Equipment } from "./player.js";

export enum EnemyTier {
  Minion = "minion",
  Common = "common",
  Elite = "elite",
  Boss = "boss",
}

export interface Enemy {
  name: string;
  tier: EnemyTier;
  hp: number;
  maxHp: number;
  attack: number;
  xpReward: number;
  goldReward: number;
}

export type CombatAction =
  | "player_attack"
  | "player_critical"
  | "player_glancing"
  | "enemy_attack"
  | "enemy_poison";

export interface CombatEvent {
  action: CombatAction;
  damage: number;
  description: string;
}

export interface CombatCardResult {
  cardId: string;
  quality: string; // AnswerQuality value — avoids circular import with index.ts
}

export interface CombatResult {
  victory: boolean;
  xpEarned: number;
  goldEarned: number;
  loot: Equipment | null;
  events: CombatEvent[];
  cardsReviewed: number;
  perfectCount: number;
  correctCount: number;
  playerHpRemaining: number;
  cardResults: CombatCardResult[];
}
