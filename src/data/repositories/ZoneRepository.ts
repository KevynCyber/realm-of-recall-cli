import type Database from "better-sqlite3";
import type { Zone } from "../../types/index.js";

export class ZoneRepository {
  constructor(private db: Database.Database) {}

  getZones(): Zone[] {
    const rows = this.db
      .prepare("SELECT * FROM zones ORDER BY order_index")
      .all() as any[];
    return rows.map((row) => this.rowToZone(row));
  }

  createZone(zone: Zone): void {
    this.db
      .prepare(
        `INSERT INTO zones (id, name, deck_id, required_mastery, boss_defeated, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        zone.id,
        zone.name,
        zone.deckId,
        zone.requiredMastery,
        zone.bossDefeated ? 1 : 0,
        zone.orderIndex,
      );
  }

  getZoneByDeckId(deckId: string): Zone | null {
    const row = this.db
      .prepare("SELECT * FROM zones WHERE deck_id = ?")
      .get(deckId) as any | undefined;
    if (!row) return null;
    return this.rowToZone(row);
  }

  markBossDefeated(zoneId: string): void {
    this.db
      .prepare("UPDATE zones SET boss_defeated = 1 WHERE id = ?")
      .run(zoneId);
  }

  private rowToZone(row: any): Zone {
    return {
      id: row.id,
      name: row.name,
      deckId: row.deck_id,
      requiredMastery: row.required_mastery,
      bossDefeated: row.boss_defeated === 1,
      orderIndex: row.order_index,
    };
  }
}
