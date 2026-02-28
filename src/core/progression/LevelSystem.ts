// Level-up detection and stat application

import { Player } from "../../types/index.js";
import { xpToNextLevel } from "./XPCalculator.js";

export interface LevelUpResult {
  leveled: boolean;
  newLevel: number;
  hpGain: number;
  attackGain: number;
  defenseGain: number;
  isMilestone: boolean;
}

const HP_PER_LEVEL = 5;
const ATTACK_PER_LEVEL = 2;
const DEFENSE_PER_LEVEL = 1;
const MILESTONE_INTERVAL = 5;

/**
 * Checks whether the player has enough XP to level up once.
 * Does NOT mutate the player — returns a result describing the potential level-up.
 */
export function checkLevelUp(player: Player): LevelUpResult {
  const needed = xpToNextLevel(player.level);

  if (player.xp < needed) {
    return {
      leveled: false,
      newLevel: player.level,
      hpGain: 0,
      attackGain: 0,
      defenseGain: 0,
      isMilestone: false,
    };
  }

  const newLevel = player.level + 1;

  return {
    leveled: true,
    newLevel,
    hpGain: HP_PER_LEVEL,
    attackGain: ATTACK_PER_LEVEL,
    defenseGain: DEFENSE_PER_LEVEL,
    isMilestone: newLevel % MILESTONE_INTERVAL === 0,
  };
}

/**
 * Applies as many level-ups as the player's current XP allows.
 * Each level-up subtracts xpToNextLevel from xp and adds stat gains.
 * Returns a new Player object (no mutation).
 */
export function applyLevelUp(player: Player): Player {
  let { level, xp, maxHp, attack, defense } = player;

  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level += 1;
    maxHp += HP_PER_LEVEL;
    attack += ATTACK_PER_LEVEL;
    defense += DEFENSE_PER_LEVEL;
  }

  return {
    ...player,
    level,
    xp,
    maxHp,
    hp: maxHp, // heal to full on level-up
    attack,
    defense,
  };
}
