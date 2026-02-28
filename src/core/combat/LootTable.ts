// Weighted loot table for equipment drops

import { EquipmentSlot, Rarity, type Equipment } from "../../types/index.js";
import { EnemyTier } from "../../types/index.js";

export const EQUIPMENT_TEMPLATES: Array<Omit<Equipment, "id">> = [
  // ── Weapons ──────────────────────────────────────────
  {
    name: "Rusty Sword",
    slot: EquipmentSlot.Weapon,
    rarity: Rarity.Common,
    attackBonus: 2,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
  },
  {
    name: "Wooden Staff",
    slot: EquipmentSlot.Weapon,
    rarity: Rarity.Common,
    attackBonus: 1,
    defenseBonus: 1,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
  },
  {
    name: "Iron Blade",
    slot: EquipmentSlot.Weapon,
    rarity: Rarity.Uncommon,
    attackBonus: 4,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
  },
  {
    name: "Battle Axe",
    slot: EquipmentSlot.Weapon,
    rarity: Rarity.Uncommon,
    attackBonus: 5,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: -1,
  },
  {
    name: "Quill of Recall",
    slot: EquipmentSlot.Weapon,
    rarity: Rarity.Rare,
    attackBonus: 6,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
    specialEffect: "Perfect answers deal +3 bonus damage",
  },
  {
    name: "Void Edge",
    slot: EquipmentSlot.Weapon,
    rarity: Rarity.Epic,
    attackBonus: 10,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 5,
  },

  // ── Armor ────────────────────────────────────────────
  {
    name: "Leather Vest",
    slot: EquipmentSlot.Armor,
    rarity: Rarity.Common,
    attackBonus: 0,
    defenseBonus: 2,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
  },
  {
    name: "Padded Jerkin",
    slot: EquipmentSlot.Armor,
    rarity: Rarity.Common,
    attackBonus: 0,
    defenseBonus: 1,
    hpBonus: 5,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
  },
  {
    name: "Chain Mail",
    slot: EquipmentSlot.Armor,
    rarity: Rarity.Uncommon,
    attackBonus: 0,
    defenseBonus: 4,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
  },
  {
    name: "Studded Plate",
    slot: EquipmentSlot.Armor,
    rarity: Rarity.Uncommon,
    attackBonus: 0,
    defenseBonus: 3,
    hpBonus: 10,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
  },
  {
    name: "Scholar's Robe",
    slot: EquipmentSlot.Armor,
    rarity: Rarity.Rare,
    attackBonus: 0,
    defenseBonus: 5,
    hpBonus: 0,
    xpBonusPct: 10,
    goldBonusPct: 0,
    critBonusPct: 0,
  },
  {
    name: "Dragon Scale",
    slot: EquipmentSlot.Armor,
    rarity: Rarity.Epic,
    attackBonus: 0,
    defenseBonus: 10,
    hpBonus: 20,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
  },

  // ── Accessories ──────────────────────────────────────
  {
    name: "Lucky Coin",
    slot: EquipmentSlot.Accessory,
    rarity: Rarity.Common,
    attackBonus: 0,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 10,
    critBonusPct: 0,
  },
  {
    name: "Copper Ring",
    slot: EquipmentSlot.Accessory,
    rarity: Rarity.Common,
    attackBonus: 1,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 1,
  },
  {
    name: "Focus Ring",
    slot: EquipmentSlot.Accessory,
    rarity: Rarity.Uncommon,
    attackBonus: 0,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 8,
    goldBonusPct: 0,
    critBonusPct: 0,
  },
  {
    name: "Silver Pendant",
    slot: EquipmentSlot.Accessory,
    rarity: Rarity.Uncommon,
    attackBonus: 0,
    defenseBonus: 2,
    hpBonus: 5,
    xpBonusPct: 0,
    goldBonusPct: 5,
    critBonusPct: 0,
  },
  {
    name: "Amulet of Insight",
    slot: EquipmentSlot.Accessory,
    rarity: Rarity.Rare,
    attackBonus: 0,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 15,
    goldBonusPct: 0,
    critBonusPct: 3,
  },
  {
    name: "Phoenix Feather",
    slot: EquipmentSlot.Accessory,
    rarity: Rarity.Rare,
    attackBonus: 0,
    defenseBonus: 0,
    hpBonus: 15,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
    specialEffect: "Revive once per combat with 25% HP",
  },
  {
    name: "Crown of Mastery",
    slot: EquipmentSlot.Accessory,
    rarity: Rarity.Epic,
    attackBonus: 0,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 20,
    goldBonusPct: 0,
    critBonusPct: 5,
    specialEffect: "Streak bonus doubled",
  },
  {
    name: "Obsidian Gauntlets",
    slot: EquipmentSlot.Armor,
    rarity: Rarity.Rare,
    attackBonus: 3,
    defenseBonus: 4,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 2,
  },
];

/** Base drop-rate distribution (sums to 1.0). */
export const DROP_RATES: Record<"none" | "common" | "uncommon" | "rare" | "epic", number> = {
  none: 0.40,
  common: 0.35,
  uncommon: 0.18,
  rare: 0.06,
  epic: 0.01,
};

interface AdjustedRates {
  none: number;
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
}

/**
 * Adjust drop rates based on enemy tier.
 * Elite: +2% rare, +0.5% epic (taken from none).
 * Boss:  +5% rare, +2% epic  (taken from none).
 */
function getAdjustedRates(tier: EnemyTier): AdjustedRates {
  const rates: AdjustedRates = { ...DROP_RATES };

  if (tier === EnemyTier.Elite) {
    rates.rare += 0.02;
    rates.epic += 0.005;
    rates.none -= 0.025;
  } else if (tier === EnemyTier.Boss) {
    rates.rare += 0.05;
    rates.epic += 0.02;
    rates.none -= 0.07;
  }

  return rates;
}

function generateId(rng: () => number): string {
  const hex = Math.floor(rng() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
  return `eq-${hex}`;
}

/**
 * Roll for loot after defeating an enemy.
 * Returns an Equipment drop or null if nothing dropped.
 *
 * @param enemyTier - tier of the defeated enemy
 * @param rng       - injectable random function returning [0, 1) for testing
 */
export function rollLoot(
  enemyTier: EnemyTier,
  rng: () => number = Math.random,
): Equipment | null {
  const rates = getAdjustedRates(enemyTier);

  const roll = rng();

  // Walk cumulative thresholds: none -> common -> uncommon -> rare -> epic
  let cumulative = 0;

  cumulative += rates.none;
  if (roll < cumulative) return null;

  cumulative += rates.common;
  if (roll < cumulative) {
    return pickFromRarity(Rarity.Common, rng);
  }

  cumulative += rates.uncommon;
  if (roll < cumulative) {
    return pickFromRarity(Rarity.Uncommon, rng);
  }

  cumulative += rates.rare;
  if (roll < cumulative) {
    return pickFromRarity(Rarity.Rare, rng);
  }

  // Anything remaining is epic
  return pickFromRarity(Rarity.Epic, rng);
}

function pickFromRarity(rarity: Rarity, rng: () => number): Equipment {
  const pool = EQUIPMENT_TEMPLATES.filter((t) => t.rarity === rarity);
  const template = pool[Math.floor(rng() * pool.length)];
  return {
    id: generateId(rng),
    ...template,
  };
}
