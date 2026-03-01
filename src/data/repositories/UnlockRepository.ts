import type Database from "better-sqlite3";

export interface UnlockRecord {
  key: string;
  unlockedAt: string | null;
}

export class UnlockRepository {
  constructor(private db: Database.Database) {}

  /**
   * Unlock a meta-progression key. No-op if already unlocked.
   */
  unlock(key: string): void {
    this.db
      .prepare(
        `INSERT INTO unlocks (key, unlocked_at)
         VALUES (?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET unlocked_at = datetime('now')
         WHERE unlocked_at IS NULL`,
      )
      .run(key);
  }

  /**
   * Check whether a given unlock key has been unlocked.
   */
  isUnlocked(key: string): boolean {
    const row = this.db
      .prepare(
        "SELECT 1 FROM unlocks WHERE key = ? AND unlocked_at IS NOT NULL",
      )
      .get(key);
    return !!row;
  }

  /**
   * Get all unlocked keys as a Set.
   */
  getUnlockedKeys(): Set<string> {
    const rows = this.db
      .prepare("SELECT key FROM unlocks WHERE unlocked_at IS NOT NULL")
      .all() as any[];
    return new Set(rows.map((r) => r.key));
  }
}
