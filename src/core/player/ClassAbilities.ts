import { PlayerClass } from "../../types/index.js";

export interface ClassAbility {
  key: string;
  name: string;
  verb: string;
  description: string;
  spCost: number;
  cooldownTurns: number;
  unlockLevel: number;
  playerClass: PlayerClass;
}

export interface AbilityEffect {
  type:
    | "reveal_wrong"
    | "show_hint"
    | "wisdom_boost"
    | "absorb_damage"
    | "damage_boost"
    | "heal"
    | "guarantee_loot"
    | "critical_boost"
    | "gold_boost";
  value: number;
  duration: number;
}

export interface ActiveAbility {
  ability: ClassAbility;
  remainingCooldown: number;
}

const SCHOLAR_ABILITIES: ClassAbility[] = [
  {
    key: "reveal",
    name: "Reveal",
    verb: "reveals",
    description: "Eliminate one wrong answer option, narrowing your choices",
    spCost: 1,
    cooldownTurns: 3,
    unlockLevel: 3,
    playerClass: PlayerClass.Scholar,
  },
  {
    key: "insight",
    name: "Insight",
    verb: "intuits",
    description: "Show a category hint for the current card",
    spCost: 1,
    cooldownTurns: 2,
    unlockLevel: 7,
    playerClass: PlayerClass.Scholar,
  },
  {
    key: "wisdom_surge",
    name: "Wisdom Surge",
    verb: "channels",
    description: "Double Wisdom XP earned for the next 3 cards",
    spCost: 2,
    cooldownTurns: 5,
    unlockLevel: 12,
    playerClass: PlayerClass.Scholar,
  },
];

const WARRIOR_ABILITIES: ClassAbility[] = [
  {
    key: "endure",
    name: "Endure",
    verb: "endures",
    description: "Absorb one wrong answer without taking damage",
    spCost: 1,
    cooldownTurns: 3,
    unlockLevel: 3,
    playerClass: PlayerClass.Warrior,
  },
  {
    key: "battle_cry",
    name: "Battle Cry",
    verb: "roars",
    description: "Next correct answer deals 3x damage",
    spCost: 2,
    cooldownTurns: 4,
    unlockLevel: 7,
    playerClass: PlayerClass.Warrior,
  },
  {
    key: "fortify",
    name: "Fortify",
    verb: "fortifies",
    description: "Heal 20% of max HP",
    spCost: 2,
    cooldownTurns: 5,
    unlockLevel: 12,
    playerClass: PlayerClass.Warrior,
  },
];

const ROGUE_ABILITIES: ClassAbility[] = [
  {
    key: "steal",
    name: "Steal",
    verb: "steals",
    description: "Guarantee a loot drop from the next enemy killed",
    spCost: 1,
    cooldownTurns: 4,
    unlockLevel: 3,
    playerClass: PlayerClass.Rogue,
  },
  {
    key: "shadow_strike",
    name: "Shadow Strike",
    verb: "strikes from shadows",
    description: "Next perfect answer deals 4x damage",
    spCost: 2,
    cooldownTurns: 4,
    unlockLevel: 7,
    playerClass: PlayerClass.Rogue,
  },
  {
    key: "lucky_find",
    name: "Lucky Find",
    verb: "discovers",
    description: "Double gold earned from the next combat",
    spCost: 1,
    cooldownTurns: 3,
    unlockLevel: 12,
    playerClass: PlayerClass.Rogue,
  },
];

const ALL_ABILITIES: Map<PlayerClass, ClassAbility[]> = new Map([
  [PlayerClass.Scholar, SCHOLAR_ABILITIES],
  [PlayerClass.Warrior, WARRIOR_ABILITIES],
  [PlayerClass.Rogue, ROGUE_ABILITIES],
]);

/**
 * Get all abilities for a given class.
 */
export function getClassAbilities(playerClass: PlayerClass): ClassAbility[] {
  return ALL_ABILITIES.get(playerClass) ?? [];
}

/**
 * Get abilities unlocked at the player's current level.
 */
export function getUnlockedAbilities(
  playerClass: PlayerClass,
  level: number,
): ClassAbility[] {
  return getClassAbilities(playerClass).filter((a) => a.unlockLevel <= level);
}

/**
 * Get the ability effect type for a given ability key.
 */
export function getAbilityEffect(key: string): AbilityEffect {
  const effects: Record<string, AbilityEffect> = {
    reveal: { type: "reveal_wrong", value: 1, duration: 1 },
    insight: { type: "show_hint", value: 1, duration: 1 },
    wisdom_surge: { type: "wisdom_boost", value: 2, duration: 3 },
    endure: { type: "absorb_damage", value: 1, duration: 1 },
    battle_cry: { type: "damage_boost", value: 3, duration: 1 },
    fortify: { type: "heal", value: 20, duration: 1 },
    steal: { type: "guarantee_loot", value: 1, duration: 1 },
    shadow_strike: { type: "critical_boost", value: 4, duration: 1 },
    lucky_find: { type: "gold_boost", value: 2, duration: 1 },
  };
  return effects[key] ?? { type: "damage_boost", value: 1, duration: 1 };
}

/**
 * Calculate skill points available at a given level (1 per level).
 */
export function getSkillPointsForLevel(level: number): number {
  return Math.max(0, level);
}

/**
 * Check if a player can use an ability.
 */
export function canUseAbility(
  ability: ClassAbility,
  playerLevel: number,
  currentSp: number,
  activeAbilities: ActiveAbility[],
): boolean {
  if (playerLevel < ability.unlockLevel) return false;
  if (currentSp < ability.spCost) return false;
  const active = activeAbilities.find((a) => a.ability.key === ability.key);
  if (active && active.remainingCooldown > 0) return false;
  return true;
}

/**
 * Tick all ability cooldowns by 1 turn.
 */
export function tickCooldowns(
  activeAbilities: ActiveAbility[],
): ActiveAbility[] {
  return activeAbilities
    .map((a) => ({
      ...a,
      remainingCooldown: Math.max(0, a.remainingCooldown - 1),
    }))
    .filter((a) => a.remainingCooldown > 0);
}
