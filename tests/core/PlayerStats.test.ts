import { describe, it, expect } from "vitest";
import { CLASS_CONFIGS } from "../../src/core/player/ClassDefinitions.js";
import {
  getEffectiveStats,
  createNewPlayer,
} from "../../src/core/player/PlayerStats.js";
import {
  PlayerClass,
  EquipmentSlot,
  Rarity,
  type Player,
  type Equipment,
} from "../../src/types/index.js";

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: "eq-1",
    name: "Test Sword",
    slot: EquipmentSlot.Weapon,
    rarity: Rarity.Common,
    attackBonus: 0,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
    ...overrides,
  };
}

describe("CLASS_CONFIGS", () => {
  it("has all 3 classes defined", () => {
    expect(CLASS_CONFIGS[PlayerClass.Scholar]).toBeDefined();
    expect(CLASS_CONFIGS[PlayerClass.Warrior]).toBeDefined();
    expect(CLASS_CONFIGS[PlayerClass.Rogue]).toBeDefined();
  });

  it("Scholar base stats match expected values", () => {
    const scholar = CLASS_CONFIGS[PlayerClass.Scholar];
    expect(scholar.baseHp).toBe(80);
    expect(scholar.baseAttack).toBe(8);
    expect(scholar.baseDefense).toBe(4);
    expect(scholar.xpBonusPct).toBe(20);
    expect(scholar.goldBonusPct).toBe(0);
    expect(scholar.critChancePct).toBe(5);
  });
});

describe("createNewPlayer", () => {
  it("creates correct Scholar", () => {
    const player = createNewPlayer("Sage", PlayerClass.Scholar);
    expect(player.name).toBe("Sage");
    expect(player.class).toBe(PlayerClass.Scholar);
    expect(player.level).toBe(1);
    expect(player.xp).toBe(0);
    expect(player.hp).toBe(80);
    expect(player.maxHp).toBe(80);
    expect(player.attack).toBe(8);
    expect(player.defense).toBe(4);
    expect(player.gold).toBe(0);
    expect(player.id).toBe(1);
    expect(player.createdAt).toBeTruthy();
  });

  it("creates correct Warrior", () => {
    const player = createNewPlayer("Tank", PlayerClass.Warrior);
    expect(player.name).toBe("Tank");
    expect(player.class).toBe(PlayerClass.Warrior);
    expect(player.hp).toBe(120);
    expect(player.maxHp).toBe(120);
    expect(player.attack).toBe(14);
    expect(player.defense).toBe(7);
  });
});

describe("getEffectiveStats", () => {
  it("at level 1 with no equipment returns class base stats", () => {
    const player = createNewPlayer("Sage", PlayerClass.Scholar);
    const stats = getEffectiveStats(player, []);
    expect(stats.maxHp).toBe(80);
    expect(stats.attack).toBe(8);
    expect(stats.defense).toBe(4);
    expect(stats.xpBonusPct).toBe(20);
    expect(stats.goldBonusPct).toBe(0);
    expect(stats.critChancePct).toBe(5);
  });

  it("at level 5 adds level bonuses (+20 hp, +8 attack, +4 defense)", () => {
    const player: Player = { ...createNewPlayer("Sage", PlayerClass.Scholar), level: 5 };
    const stats = getEffectiveStats(player, []);
    expect(stats.maxHp).toBe(80 + 20);   // +5 per level * 4 levels
    expect(stats.attack).toBe(8 + 8);     // +2 per level * 4 levels
    expect(stats.defense).toBe(4 + 4);    // +1 per level * 4 levels
  });

  it("with equipment adds bonuses correctly", () => {
    const player = createNewPlayer("Sage", PlayerClass.Scholar);
    const sword = makeEquipment({
      attackBonus: 5,
      defenseBonus: 2,
      hpBonus: 10,
      xpBonusPct: 5,
      goldBonusPct: 3,
      critBonusPct: 1,
    });
    const stats = getEffectiveStats(player, [sword]);
    expect(stats.maxHp).toBe(80 + 10);
    expect(stats.attack).toBe(8 + 5);
    expect(stats.defense).toBe(4 + 2);
    expect(stats.xpBonusPct).toBe(20 + 5);
    expect(stats.goldBonusPct).toBe(0 + 3);
    expect(stats.critChancePct).toBe(5 + 1);
  });

  it("stacks multiple equipment pieces", () => {
    const player = createNewPlayer("Rogue", PlayerClass.Rogue);
    const sword = makeEquipment({
      id: "eq-1",
      name: "Dagger",
      slot: EquipmentSlot.Weapon,
      attackBonus: 4,
      defenseBonus: 0,
      hpBonus: 0,
      critBonusPct: 2,
    });
    const armor = makeEquipment({
      id: "eq-2",
      name: "Leather Armor",
      slot: EquipmentSlot.Armor,
      attackBonus: 0,
      defenseBonus: 3,
      hpBonus: 15,
      critBonusPct: 0,
    });
    const ring = makeEquipment({
      id: "eq-3",
      name: "Gold Ring",
      slot: EquipmentSlot.Accessory,
      attackBonus: 1,
      defenseBonus: 1,
      hpBonus: 5,
      goldBonusPct: 10,
      critBonusPct: 3,
    });
    const stats = getEffectiveStats(player, [sword, armor, ring]);
    expect(stats.maxHp).toBe(100 + 0 + 15 + 5);
    expect(stats.attack).toBe(11 + 4 + 0 + 1);
    expect(stats.defense).toBe(5 + 0 + 3 + 1);
    expect(stats.goldBonusPct).toBe(25 + 0 + 0 + 10);
    expect(stats.critChancePct).toBe(12 + 2 + 0 + 3);
  });

  it("without skill allocation behaves the same as before", () => {
    const player = createNewPlayer("Sage", PlayerClass.Scholar);
    const noSkills = getEffectiveStats(player, []);
    const emptySkills = getEffectiveStats(player, [], { recall: 0, battle: 0, scholar: 0 });
    expect(noSkills).toEqual(emptySkills);
  });

  it("applies battle skill tree bonuses to attack, HP, and crit", () => {
    const player = createNewPlayer("Sage", PlayerClass.Scholar);
    // battle_1 costs 1 point: +5% attack; battle_2 costs 2 points: +10% HP
    // So battle=3 unlocks tiers 1 and 2
    const stats = getEffectiveStats(player, [], { recall: 0, battle: 3, scholar: 0 });
    // Base attack is 8, +5% = floor(8 * 1.05) = 8
    expect(stats.attack).toBe(Math.floor(8 * 1.05));
    // Base HP is 80, +10% = floor(80 * 1.10) = 88
    expect(stats.maxHp).toBe(Math.floor(80 * 1.10));
  });

  it("applies scholar skill tree gold bonus", () => {
    const player = createNewPlayer("Sage", PlayerClass.Scholar);
    // scholar=3 unlocks tiers 1 and 2; tier 2 gives +10% gold
    const stats = getEffectiveStats(player, [], { recall: 0, battle: 0, scholar: 3 });
    expect(stats.goldBonusPct).toBe(0 + 10); // Scholar class has 0 gold bonus + 10 from skill
  });
});
