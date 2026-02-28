import type { Enemy } from "../../types/index.js";

export interface AscensionModifier {
  level: number;
  name: string;
  description: string;
}

export interface CombatSettings {
  timerSeconds: number;
  hintsEnabled: boolean;
  partialCreditEnabled: boolean;
  lootDropMultiplier: number;
  startingHpPercent: number;
  enemyPoisonDamage: number;
  consecutiveCorrectRequired: number;
}

const ASCENSION_MODIFIERS: AscensionModifier[] = [
  { level: 1, name: "Hardened Foes", description: "Enemies have +15% HP" },
  { level: 2, name: "Time Pressure", description: "Timer reduced by 5 seconds" },
  { level: 3, name: "No Mercy", description: "Partial answers count as Wrong" },
  { level: 4, name: "Brutal Strikes", description: "Enemies deal +20% damage" },
  { level: 5, name: "Weakened Start", description: "Start combat at 80% HP" },
  { level: 6, name: "Scarce Loot", description: "Loot drop rates halved" },
  { level: 7, name: "No Hints", description: "Card hints are disabled" },
  { level: 8, name: "Venomous", description: "Enemies apply 2 poison damage per turn" },
  { level: 9, name: "Precision Required", description: "Must answer 2 consecutive correct to deal damage" },
  { level: 10, name: "Nightmare", description: "All modifiers active, enemies have +50% HP" },
];

/**
 * Get all active modifiers for the given ascension level (cumulative).
 */
export function getActiveModifiers(ascensionLevel: number): AscensionModifier[] {
  return ASCENSION_MODIFIERS.filter((m) => m.level <= ascensionLevel);
}

/**
 * Apply ascension modifiers to an enemy's stats.
 */
export function applyAscensionToEnemy(enemy: Enemy, ascensionLevel: number): Enemy {
  if (ascensionLevel <= 0) return enemy;

  let hpMultiplier = 1;
  let attackMultiplier = 1;

  if (ascensionLevel >= 1) hpMultiplier += 0.15;
  if (ascensionLevel >= 4) attackMultiplier += 0.20;
  if (ascensionLevel >= 10) hpMultiplier += 0.50;

  const newHp = Math.ceil(enemy.hp * hpMultiplier);
  return {
    ...enemy,
    hp: newHp,
    maxHp: newHp,
    attack: Math.ceil(enemy.attack * attackMultiplier),
  };
}

/**
 * Apply ascension modifiers to combat settings.
 */
export function applyAscensionToCombat(
  baseSettings: CombatSettings,
  ascensionLevel: number,
): CombatSettings {
  if (ascensionLevel <= 0) return baseSettings;

  const settings = { ...baseSettings };

  if (ascensionLevel >= 2) settings.timerSeconds = Math.max(10, settings.timerSeconds - 5);
  if (ascensionLevel >= 3) settings.partialCreditEnabled = false;
  if (ascensionLevel >= 5) settings.startingHpPercent = 80;
  if (ascensionLevel >= 6) settings.lootDropMultiplier *= 0.5;
  if (ascensionLevel >= 7) settings.hintsEnabled = false;
  if (ascensionLevel >= 8) settings.enemyPoisonDamage = 2;
  if (ascensionLevel >= 9) settings.consecutiveCorrectRequired = 2;

  return settings;
}

/**
 * Get default combat settings (before ascension modifiers).
 */
export function getDefaultCombatSettings(): CombatSettings {
  return {
    timerSeconds: 30,
    hintsEnabled: true,
    partialCreditEnabled: true,
    lootDropMultiplier: 1.0,
    startingHpPercent: 100,
    enemyPoisonDamage: 0,
    consecutiveCorrectRequired: 1,
  };
}

/**
 * Check if player can unlock the next ascension level.
 */
export function canUnlockNextAscension(
  currentAscension: number,
  zones: Array<{ bossDefeated: boolean }>,
): boolean {
  if (zones.length === 0) return false;
  if (currentAscension >= 10) return false;
  return zones.every((z) => z.bossDefeated);
}

/**
 * Get the total number of ascension levels available.
 */
export function getMaxAscensionLevel(): number {
  return 10;
}
