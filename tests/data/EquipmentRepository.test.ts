import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../src/data/database.js";
import { EquipmentRepository } from "../../src/data/repositories/EquipmentRepository.js";
import { PlayerRepository } from "../../src/data/repositories/PlayerRepository.js";
import { EquipmentSlot, Rarity, PlayerClass } from "../../src/types/index.js";
import type { Equipment, Player } from "../../src/types/index.js";

let db: Database.Database;
let equipRepo: EquipmentRepository;
let playerRepo: PlayerRepository;

const testPlayer: Player = {
  id: 1,
  name: "TestHero",
  class: PlayerClass.Scholar,
  level: 1,
  xp: 0,
  hp: 100,
  maxHp: 100,
  attack: 10,
  defense: 5,
  gold: 50,
  streakDays: 0,
  longestStreak: 0,
  lastReviewDate: null,
  shieldCount: 0,
  totalReviews: 0,
  totalCorrect: 0,
  combatWins: 0,
  combatLosses: 0,
  wisdomXp: 0,
  ascensionLevel: 0,
  skillPoints: 0,
  dailyChallengeSeed: null,
  dailyChallengeCompleted: false,
  dailyChallengeScore: 0,
  dailyChallengeDate: null,
  createdAt: new Date().toISOString(),
};

const sword: Equipment = {
  id: "sword1",
  name: "Iron Sword",
  slot: EquipmentSlot.Weapon,
  rarity: Rarity.Common,
  attackBonus: 5,
  defenseBonus: 0,
  hpBonus: 0,
  xpBonusPct: 0,
  goldBonusPct: 0,
  critBonusPct: 0,
};

const betterSword: Equipment = {
  id: "sword2",
  name: "Steel Sword",
  slot: EquipmentSlot.Weapon,
  rarity: Rarity.Uncommon,
  attackBonus: 10,
  defenseBonus: 0,
  hpBonus: 0,
  xpBonusPct: 0,
  goldBonusPct: 0,
  critBonusPct: 5,
};

const shield: Equipment = {
  id: "armor1",
  name: "Wooden Shield",
  slot: EquipmentSlot.Armor,
  rarity: Rarity.Common,
  attackBonus: 0,
  defenseBonus: 5,
  hpBonus: 10,
  xpBonusPct: 0,
  goldBonusPct: 0,
  critBonusPct: 0,
  specialEffect: "Block +5%",
};

beforeEach(() => {
  db = getInMemoryDatabase();
  equipRepo = new EquipmentRepository(db);
  playerRepo = new PlayerRepository(db);
  playerRepo.createPlayer(testPlayer);
});

describe("EquipmentRepository", () => {
  it("adds equipment and retrieves it in inventory", () => {
    equipRepo.addEquipment(sword);
    equipRepo.addToInventory("sword1");
    const inventory = equipRepo.getInventory();
    expect(inventory).toHaveLength(1);
    expect(inventory[0].equipment.name).toBe("Iron Sword");
    expect(inventory[0].equipped).toBe(false);
  });

  it("preserves special effect on equipment", () => {
    equipRepo.addEquipment(shield);
    equipRepo.addToInventory("armor1");
    const inventory = equipRepo.getInventory();
    expect(inventory[0].equipment.specialEffect).toBe("Block +5%");
  });

  it("returns undefined for specialEffect when not set", () => {
    equipRepo.addEquipment(sword);
    equipRepo.addToInventory("sword1");
    const inventory = equipRepo.getInventory();
    expect(inventory[0].equipment.specialEffect).toBeUndefined();
  });

  it("equips and unequips an item", () => {
    equipRepo.addEquipment(sword);
    equipRepo.addToInventory("sword1");
    const inventory = equipRepo.getInventory();
    const invId = (inventory[0] as any).inventoryId;

    equipRepo.equipItem(invId);
    const equipped = equipRepo.getEquipped();
    expect(equipped).toHaveLength(1);
    expect(equipped[0].id).toBe("sword1");

    equipRepo.unequipItem(invId);
    const afterUnequip = equipRepo.getEquipped();
    expect(afterUnequip).toHaveLength(0);
  });

  it("equipping swaps same slot item", () => {
    equipRepo.addEquipment(sword);
    equipRepo.addEquipment(betterSword);
    equipRepo.addToInventory("sword1");
    equipRepo.addToInventory("sword2");

    const inventory = equipRepo.getInventory();
    const sword1InvId = (inventory.find((i) => i.equipment.id === "sword1") as any).inventoryId;
    const sword2InvId = (inventory.find((i) => i.equipment.id === "sword2") as any).inventoryId;

    // Equip first sword
    equipRepo.equipItem(sword1InvId);
    let equipped = equipRepo.getEquipped();
    expect(equipped).toHaveLength(1);
    expect(equipped[0].id).toBe("sword1");

    // Equip second sword — should swap out first
    equipRepo.equipItem(sword2InvId);
    equipped = equipRepo.getEquipped();
    expect(equipped).toHaveLength(1);
    expect(equipped[0].id).toBe("sword2");

    // Verify first sword is no longer equipped
    const inv = equipRepo.getInventory();
    const sword1 = inv.find((i) => i.equipment.id === "sword1");
    expect(sword1!.equipped).toBe(false);
  });

  it("equipping different slots does not swap", () => {
    equipRepo.addEquipment(sword);
    equipRepo.addEquipment(shield);
    equipRepo.addToInventory("sword1");
    equipRepo.addToInventory("armor1");

    const inventory = equipRepo.getInventory();
    const swordInvId = (inventory.find((i) => i.equipment.id === "sword1") as any).inventoryId;
    const shieldInvId = (inventory.find((i) => i.equipment.id === "armor1") as any).inventoryId;

    equipRepo.equipItem(swordInvId);
    equipRepo.equipItem(shieldInvId);
    const equipped = equipRepo.getEquipped();
    expect(equipped).toHaveLength(2);
  });
});
