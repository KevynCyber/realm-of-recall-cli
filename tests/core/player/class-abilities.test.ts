import { describe, it, expect } from "vitest";
import {
  getClassAbilities,
  getUnlockedAbilities,
  getAbilityEffect,
  getSkillPointsForLevel,
  canUseAbility,
  tickCooldowns,
} from "../../../src/core/player/ClassAbilities.js";
import type { ClassAbility, ActiveAbility } from "../../../src/core/player/ClassAbilities.js";
import { PlayerClass } from "../../../src/types/index.js";

describe("getClassAbilities", () => {
  it("returns 3 abilities for Scholar", () => {
    const abilities = getClassAbilities(PlayerClass.Scholar);
    expect(abilities).toHaveLength(3);
    expect(abilities.every((a) => a.playerClass === PlayerClass.Scholar)).toBe(true);
  });

  it("returns 3 abilities for Warrior", () => {
    const abilities = getClassAbilities(PlayerClass.Warrior);
    expect(abilities).toHaveLength(3);
    expect(abilities.every((a) => a.playerClass === PlayerClass.Warrior)).toBe(true);
  });

  it("returns 3 abilities for Rogue", () => {
    const abilities = getClassAbilities(PlayerClass.Rogue);
    expect(abilities).toHaveLength(3);
    expect(abilities.every((a) => a.playerClass === PlayerClass.Rogue)).toBe(true);
  });

  it("returns empty for unknown class", () => {
    const abilities = getClassAbilities("unknown" as PlayerClass);
    expect(abilities).toEqual([]);
  });

  it("Scholar abilities: Reveal, Insight, Wisdom Surge", () => {
    const names = getClassAbilities(PlayerClass.Scholar).map((a) => a.key);
    expect(names).toEqual(["reveal", "insight", "wisdom_surge"]);
  });

  it("Warrior abilities: Endure, Battle Cry, Fortify", () => {
    const names = getClassAbilities(PlayerClass.Warrior).map((a) => a.key);
    expect(names).toEqual(["endure", "battle_cry", "fortify"]);
  });

  it("Rogue abilities: Steal, Shadow Strike, Lucky Find", () => {
    const names = getClassAbilities(PlayerClass.Rogue).map((a) => a.key);
    expect(names).toEqual(["steal", "shadow_strike", "lucky_find"]);
  });

  it("all abilities have verb field", () => {
    for (const cls of [PlayerClass.Scholar, PlayerClass.Warrior, PlayerClass.Rogue]) {
      getClassAbilities(cls).forEach((a) => {
        expect(a.verb).toBeTruthy();
      });
    }
  });
});

describe("getUnlockedAbilities", () => {
  it("returns no abilities at level 1", () => {
    expect(getUnlockedAbilities(PlayerClass.Scholar, 1)).toEqual([]);
  });

  it("returns 1 ability at level 3", () => {
    const abilities = getUnlockedAbilities(PlayerClass.Scholar, 3);
    expect(abilities).toHaveLength(1);
    expect(abilities[0].key).toBe("reveal");
  });

  it("returns 2 abilities at level 7", () => {
    const abilities = getUnlockedAbilities(PlayerClass.Scholar, 7);
    expect(abilities).toHaveLength(2);
  });

  it("returns all 3 abilities at level 12", () => {
    const abilities = getUnlockedAbilities(PlayerClass.Scholar, 12);
    expect(abilities).toHaveLength(3);
  });

  it("returns all 3 abilities above level 12", () => {
    const abilities = getUnlockedAbilities(PlayerClass.Warrior, 20);
    expect(abilities).toHaveLength(3);
  });
});

describe("getAbilityEffect", () => {
  it("returns reveal_wrong for reveal", () => {
    const effect = getAbilityEffect("reveal");
    expect(effect.type).toBe("reveal_wrong");
    expect(effect.value).toBe(1);
  });

  it("returns show_hint for insight", () => {
    const effect = getAbilityEffect("insight");
    expect(effect.type).toBe("show_hint");
  });

  it("returns wisdom_boost for wisdom_surge", () => {
    const effect = getAbilityEffect("wisdom_surge");
    expect(effect.type).toBe("wisdom_boost");
    expect(effect.value).toBe(2);
    expect(effect.duration).toBe(3);
  });

  it("returns absorb_damage for endure", () => {
    expect(getAbilityEffect("endure").type).toBe("absorb_damage");
  });

  it("returns damage_boost for battle_cry", () => {
    const effect = getAbilityEffect("battle_cry");
    expect(effect.type).toBe("damage_boost");
    expect(effect.value).toBe(3);
  });

  it("returns heal for fortify", () => {
    const effect = getAbilityEffect("fortify");
    expect(effect.type).toBe("heal");
    expect(effect.value).toBe(20);
  });

  it("returns guarantee_loot for steal", () => {
    expect(getAbilityEffect("steal").type).toBe("guarantee_loot");
  });

  it("returns critical_boost for shadow_strike", () => {
    const effect = getAbilityEffect("shadow_strike");
    expect(effect.type).toBe("critical_boost");
    expect(effect.value).toBe(4);
  });

  it("returns gold_boost for lucky_find", () => {
    const effect = getAbilityEffect("lucky_find");
    expect(effect.type).toBe("gold_boost");
    expect(effect.value).toBe(2);
  });

  it("returns default for unknown key", () => {
    const effect = getAbilityEffect("unknown");
    expect(effect.type).toBe("damage_boost");
    expect(effect.value).toBe(1);
  });
});

describe("getSkillPointsForLevel", () => {
  it("returns 0 for level 0", () => {
    expect(getSkillPointsForLevel(0)).toBe(0);
  });

  it("returns level number for positive levels", () => {
    expect(getSkillPointsForLevel(5)).toBe(5);
    expect(getSkillPointsForLevel(10)).toBe(10);
  });

  it("returns 0 for negative levels", () => {
    expect(getSkillPointsForLevel(-1)).toBe(0);
  });
});

describe("canUseAbility", () => {
  const reveal: ClassAbility = {
    key: "reveal",
    name: "Reveal",
    verb: "reveals",
    description: "test",
    spCost: 1,
    cooldownTurns: 3,
    unlockLevel: 3,
    playerClass: PlayerClass.Scholar,
  };

  it("returns true when all conditions met", () => {
    expect(canUseAbility(reveal, 5, 2, [])).toBe(true);
  });

  it("returns false when level too low", () => {
    expect(canUseAbility(reveal, 2, 2, [])).toBe(false);
  });

  it("returns false when not enough SP", () => {
    expect(canUseAbility(reveal, 5, 0, [])).toBe(false);
  });

  it("returns false when ability is on cooldown", () => {
    const active: ActiveAbility[] = [
      { ability: reveal, remainingCooldown: 2 },
    ];
    expect(canUseAbility(reveal, 5, 2, active)).toBe(false);
  });

  it("returns true when cooldown is 0", () => {
    const active: ActiveAbility[] = [
      { ability: reveal, remainingCooldown: 0 },
    ];
    expect(canUseAbility(reveal, 5, 2, active)).toBe(true);
  });
});

describe("tickCooldowns", () => {
  const reveal: ClassAbility = {
    key: "reveal",
    name: "Reveal",
    verb: "reveals",
    description: "test",
    spCost: 1,
    cooldownTurns: 3,
    unlockLevel: 3,
    playerClass: PlayerClass.Scholar,
  };

  it("reduces cooldowns by 1", () => {
    const active: ActiveAbility[] = [
      { ability: reveal, remainingCooldown: 3 },
    ];
    const result = tickCooldowns(active);
    expect(result).toHaveLength(1);
    expect(result[0].remainingCooldown).toBe(2);
  });

  it("removes abilities when cooldown reaches 0", () => {
    const active: ActiveAbility[] = [
      { ability: reveal, remainingCooldown: 1 },
    ];
    const result = tickCooldowns(active);
    expect(result).toHaveLength(0);
  });

  it("handles empty array", () => {
    expect(tickCooldowns([])).toEqual([]);
  });

  it("does not go below 0", () => {
    const active: ActiveAbility[] = [
      { ability: reveal, remainingCooldown: 0 },
    ];
    const result = tickCooldowns(active);
    // Already at 0, should be filtered out
    expect(result).toHaveLength(0);
  });
});
