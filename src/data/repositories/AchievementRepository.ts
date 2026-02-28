import type Database from "better-sqlite3";
import crypto from "crypto";

export interface AchievementRecord {
  key: string;
  title: string;
  description: string;
  unlockedAt: string;
}

export class AchievementRepository {
  constructor(private db: Database.Database) {}

  getUnlocked(): AchievementRecord[] {
    return (
      this.db
        .prepare(
          "SELECT key, title, description, unlocked_at FROM achievements WHERE unlocked_at IS NOT NULL",
        )
        .all() as any[]
    ).map((row) => ({
      key: row.key,
      title: row.title,
      description: row.description,
      unlockedAt: row.unlocked_at,
    }));
  }

  getUnlockedKeys(): Set<string> {
    const rows = this.db
      .prepare("SELECT key FROM achievements WHERE unlocked_at IS NOT NULL")
      .all() as any[];
    return new Set(rows.map((r) => r.key));
  }

  isUnlocked(key: string): boolean {
    const row = this.db
      .prepare(
        "SELECT 1 FROM achievements WHERE key = ? AND unlocked_at IS NOT NULL",
      )
      .get(key);
    return !!row;
  }

  unlock(key: string, title: string, description: string): void {
    this.db
      .prepare(
        `INSERT INTO achievements (id, key, title, description, unlocked_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET unlocked_at = datetime('now')
         WHERE unlocked_at IS NULL`,
      )
      .run(crypto.randomUUID(), key, title, description);
  }
}
