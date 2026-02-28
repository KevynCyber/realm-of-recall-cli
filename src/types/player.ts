// Player types

export enum PlayerClass {
  Scholar = "scholar",
  Warrior = "warrior",
  Rogue = "rogue",
}

export interface ClassConfig {
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  xpBonusPct: number;
  goldBonusPct: number;
  critChancePct: number;
}

export enum EquipmentSlot {
  Weapon = "weapon",
  Armor = "armor",
  Accessory = "accessory",
}

export enum Rarity {
  Common = "common",
  Uncommon = "uncommon",
  Rare = "rare",
  Epic = "epic",
}

export interface Equipment {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: Rarity;
  attackBonus: number;
  defenseBonus: number;
  hpBonus: number;
  xpBonusPct: number;
  goldBonusPct: number;
  critBonusPct: number;
  specialEffect?: string;
}

export interface InventoryItem {
  equipment: Equipment;
  equipped: boolean;
}

export interface Player {
  id: number;
  name: string;
  class: PlayerClass;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  gold: number;
  streakDays: number;
  longestStreak: number;
  lastReviewDate: string | null;
  shieldCount: number;
  totalReviews: number;
  totalCorrect: number;
  combatWins: number;
  combatLosses: number;
  wisdomXp: number;
  createdAt: string;
}
