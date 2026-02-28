import { PlayerClass, type ClassConfig } from "../../types/index.js";

export const CLASS_CONFIGS: Record<PlayerClass, ClassConfig> = {
  [PlayerClass.Scholar]: {
    baseHp: 80,
    baseAttack: 8,
    baseDefense: 4,
    xpBonusPct: 20,
    goldBonusPct: 0,
    critChancePct: 5,
  },
  [PlayerClass.Warrior]: {
    baseHp: 120,
    baseAttack: 14,
    baseDefense: 7,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critChancePct: 8,
  },
  [PlayerClass.Rogue]: {
    baseHp: 100,
    baseAttack: 11,
    baseDefense: 5,
    xpBonusPct: 0,
    goldBonusPct: 25,
    critChancePct: 12,
  },
};
