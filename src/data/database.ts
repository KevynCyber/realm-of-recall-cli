import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

const DATA_DIR = path.join(os.homedir(), ".realm-of-recall");
const DB_PATH = path.join(DATA_DIR, "game.db");

let db: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = dbPath ?? DB_PATH;
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function getInMemoryDatabase(): Database.Database {
  const memDb = new Database(":memory:");
  memDb.pragma("foreign_keys = ON");
  runMigrations(memDb);
  return memDb;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    database
      .prepare("SELECT name FROM _migrations")
      .all()
      .map((row: any) => row.name),
  );

  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      database.exec(migration.sql);
      database
        .prepare("INSERT INTO _migrations (name) VALUES (?)")
        .run(migration.name);
    }
  }
}

const migrations = [
  {
    name: "001_initial",
    sql: `
      CREATE TABLE decks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE cards (
        id TEXT PRIMARY KEY,
        front TEXT NOT NULL,
        back TEXT NOT NULL,
        acceptable_answers TEXT NOT NULL DEFAULT '[]',
        type TEXT NOT NULL DEFAULT 'basic',
        deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE
      );

      CREATE TABLE recall_stats (
        card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
        total_attempts INTEGER NOT NULL DEFAULT 0,
        correct_count INTEGER NOT NULL DEFAULT 0,
        consecutive_correct INTEGER NOT NULL DEFAULT 0,
        best_streak INTEGER NOT NULL DEFAULT 0,
        total_response_time REAL NOT NULL DEFAULT 0,
        ease_factor REAL NOT NULL DEFAULT 2.5,
        interval_days REAL NOT NULL DEFAULT 0,
        repetitions INTEGER NOT NULL DEFAULT 0,
        next_review_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE recall_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        timestamp INTEGER NOT NULL,
        response_time REAL NOT NULL,
        quality TEXT NOT NULL,
        was_timed INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX idx_cards_deck ON cards(deck_id);
      CREATE INDEX idx_attempts_card ON recall_attempts(card_id);
      CREATE INDEX idx_stats_next_review ON recall_stats(next_review_at);
    `,
  },
  {
    name: "002_gamification",
    sql: `
      CREATE TABLE player (
        id INTEGER PRIMARY KEY DEFAULT 1,
        name TEXT NOT NULL DEFAULT 'Hero',
        class TEXT NOT NULL DEFAULT 'scholar',
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        hp INTEGER NOT NULL DEFAULT 100,
        max_hp INTEGER NOT NULL DEFAULT 100,
        attack INTEGER NOT NULL DEFAULT 10,
        defense INTEGER NOT NULL DEFAULT 5,
        gold INTEGER NOT NULL DEFAULT 0,
        streak_days INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        last_review_date TEXT,
        shield_count INTEGER NOT NULL DEFAULT 0,
        total_reviews INTEGER NOT NULL DEFAULT 0,
        total_correct INTEGER NOT NULL DEFAULT 0,
        combat_wins INTEGER NOT NULL DEFAULT 0,
        combat_losses INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE equipment (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slot TEXT NOT NULL CHECK(slot IN ('weapon','armor','accessory')),
        rarity TEXT NOT NULL DEFAULT 'common' CHECK(rarity IN ('common','uncommon','rare','epic')),
        attack_bonus INTEGER NOT NULL DEFAULT 0,
        defense_bonus INTEGER NOT NULL DEFAULT 0,
        hp_bonus INTEGER NOT NULL DEFAULT 0,
        xp_bonus_pct INTEGER NOT NULL DEFAULT 0,
        gold_bonus_pct INTEGER NOT NULL DEFAULT 0,
        crit_bonus_pct INTEGER NOT NULL DEFAULT 0,
        special_effect TEXT
      );

      CREATE TABLE inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL DEFAULT 1 REFERENCES player(id),
        equipment_id TEXT NOT NULL REFERENCES equipment(id),
        equipped INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE zones (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        required_mastery REAL NOT NULL DEFAULT 0.7,
        boss_defeated INTEGER NOT NULL DEFAULT 0,
        order_index INTEGER NOT NULL DEFAULT 0
      );

      ALTER TABLE recall_stats ADD COLUMN difficulty REAL NOT NULL DEFAULT 5.0;
      ALTER TABLE recall_stats ADD COLUMN stability REAL NOT NULL DEFAULT 0;
      ALTER TABLE recall_stats ADD COLUMN lapses INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE recall_stats ADD COLUMN card_state TEXT NOT NULL DEFAULT 'new';
      ALTER TABLE recall_stats ADD COLUMN last_review_at TEXT;
    `,
  },
];
