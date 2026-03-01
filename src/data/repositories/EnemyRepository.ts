import type Database from "better-sqlite3";
import { EnemyTier } from "../../types/combat.js";

export interface EnemyEncounter {
  id: number;
  enemyName: string;
  enemyTier: number;
  timesDefeated: number;
  firstDefeatedAt: string | null;
  lastDefeatedAt: string | null;
}

const TIER_TO_INT: Record<EnemyTier, number> = {
  [EnemyTier.Minion]: 0,
  [EnemyTier.Common]: 1,
  [EnemyTier.Elite]: 2,
  [EnemyTier.Boss]: 3,
};

export function enemyTierToInt(tier: EnemyTier): number {
  return TIER_TO_INT[tier];
}

export class EnemyRepository {
  constructor(private db: Database.Database) {}

  trackEncounter(name: string, tier: EnemyTier): void {
    const tierInt = enemyTierToInt(tier);
    this.db
      .prepare(
        `INSERT INTO enemy_encounters (enemy_name, enemy_tier, times_defeated, first_defeated_at, last_defeated_at)
         VALUES (?, ?, 1, datetime('now'), datetime('now'))
         ON CONFLICT(enemy_name, enemy_tier) DO UPDATE SET
           times_defeated = times_defeated + 1,
           last_defeated_at = datetime('now')`,
      )
      .run(name, tierInt);
  }

  getEncounters(): EnemyEncounter[] {
    const rows = this.db
      .prepare(
        "SELECT id, enemy_name, enemy_tier, times_defeated, first_defeated_at, last_defeated_at FROM enemy_encounters ORDER BY enemy_tier ASC, enemy_name ASC",
      )
      .all() as any[];
    return rows.map((row) => ({
      id: row.id,
      enemyName: row.enemy_name,
      enemyTier: row.enemy_tier,
      timesDefeated: row.times_defeated,
      firstDefeatedAt: row.first_defeated_at,
      lastDefeatedAt: row.last_defeated_at,
    }));
  }

  getEncounterCount(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM enemy_encounters WHERE times_defeated > 0")
      .get() as any;
    return row.count;
  }
}
