import type Database from "better-sqlite3";
import type { Equipment, InventoryItem } from "../../types/index.js";
import { EquipmentSlot, Rarity } from "../../types/index.js";

export class EquipmentRepository {
  constructor(private db: Database.Database) {}

  addEquipment(equipment: Equipment): void {
    this.db
      .prepare(
        `INSERT INTO equipment (id, name, slot, rarity, attack_bonus, defense_bonus,
          hp_bonus, xp_bonus_pct, gold_bonus_pct, crit_bonus_pct, special_effect)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        equipment.id,
        equipment.name,
        equipment.slot,
        equipment.rarity,
        equipment.attackBonus,
        equipment.defenseBonus,
        equipment.hpBonus,
        equipment.xpBonusPct,
        equipment.goldBonusPct,
        equipment.critBonusPct,
        equipment.specialEffect ?? null,
      );
  }

  addToInventory(equipmentId: string, playerId: number = 1): void {
    this.db
      .prepare(
        "INSERT INTO inventory (player_id, equipment_id) VALUES (?, ?)",
      )
      .run(playerId, equipmentId);
  }

  getInventory(playerId: number = 1): InventoryItem[] {
    const rows = this.db
      .prepare(
        `SELECT i.id as inventory_id, i.equipped, e.*
         FROM inventory i
         JOIN equipment e ON e.id = i.equipment_id
         WHERE i.player_id = ?`,
      )
      .all(playerId) as any[];
    return rows.map((row) => ({
      inventoryId: row.inventory_id,
      equipped: row.equipped === 1,
      equipment: this.rowToEquipment(row),
    }));
  }

  getEquipped(playerId: number = 1): Equipment[] {
    const rows = this.db
      .prepare(
        `SELECT e.*
         FROM inventory i
         JOIN equipment e ON e.id = i.equipment_id
         WHERE i.player_id = ? AND i.equipped = 1`,
      )
      .all(playerId) as any[];
    return rows.map((row) => this.rowToEquipment(row));
  }

  equipItem(inventoryId: number): void {
    const tx = this.db.transaction(() => {
      // Get the slot of the item being equipped
      const row = this.db
        .prepare(
          `SELECT e.slot, i.player_id
           FROM inventory i
           JOIN equipment e ON e.id = i.equipment_id
           WHERE i.id = ?`,
        )
        .get(inventoryId) as any | undefined;
      if (!row) return;

      // Unequip any existing item in the same slot
      this.db
        .prepare(
          `UPDATE inventory SET equipped = 0
           WHERE player_id = ? AND equipped = 1
             AND equipment_id IN (SELECT id FROM equipment WHERE slot = ?)`,
        )
        .run(row.player_id, row.slot);

      // Equip the target item
      this.db
        .prepare("UPDATE inventory SET equipped = 1 WHERE id = ?")
        .run(inventoryId);
    });
    tx();
  }

  unequipItem(inventoryId: number): void {
    this.db
      .prepare("UPDATE inventory SET equipped = 0 WHERE id = ?")
      .run(inventoryId);
  }

  private rowToEquipment(row: any): Equipment {
    return {
      id: row.id,
      name: row.name,
      slot: row.slot as EquipmentSlot,
      rarity: row.rarity as Rarity,
      attackBonus: row.attack_bonus,
      defenseBonus: row.defense_bonus,
      hpBonus: row.hp_bonus,
      xpBonusPct: row.xp_bonus_pct,
      goldBonusPct: row.gold_bonus_pct,
      critBonusPct: row.crit_bonus_pct,
      specialEffect: row.special_effect ?? undefined,
    };
  }
}
