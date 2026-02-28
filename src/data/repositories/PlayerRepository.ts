import type Database from "better-sqlite3";
import type { Player } from "../../types/index.js";
import { PlayerClass } from "../../types/index.js";

export class PlayerRepository {
  constructor(private db: Database.Database) {}

  getPlayer(): Player | null {
    const row = this.db
      .prepare("SELECT * FROM player WHERE id = 1")
      .get() as any | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      class: row.class as PlayerClass,
      level: row.level,
      xp: row.xp,
      hp: row.hp,
      maxHp: row.max_hp,
      attack: row.attack,
      defense: row.defense,
      gold: row.gold,
      streakDays: row.streak_days,
      longestStreak: row.longest_streak,
      lastReviewDate: row.last_review_date,
      shieldCount: row.shield_count,
      totalReviews: row.total_reviews,
      totalCorrect: row.total_correct,
      combatWins: row.combat_wins,
      combatLosses: row.combat_losses,
      createdAt: row.created_at,
    };
  }

  createPlayer(player: Player): void {
    this.db
      .prepare(
        `INSERT INTO player (id, name, class, level, xp, hp, max_hp, attack, defense, gold,
          streak_days, longest_streak, last_review_date, shield_count,
          total_reviews, total_correct, combat_wins, combat_losses, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        player.id,
        player.name,
        player.class,
        player.level,
        player.xp,
        player.hp,
        player.maxHp,
        player.attack,
        player.defense,
        player.gold,
        player.streakDays,
        player.longestStreak,
        player.lastReviewDate,
        player.shieldCount,
        player.totalReviews,
        player.totalCorrect,
        player.combatWins,
        player.combatLosses,
        player.createdAt,
      );
  }

  updatePlayer(player: Player): void {
    this.db
      .prepare(
        `UPDATE player SET
          name = ?, class = ?, level = ?, xp = ?, hp = ?, max_hp = ?,
          attack = ?, defense = ?, gold = ?, streak_days = ?, longest_streak = ?,
          last_review_date = ?, shield_count = ?, total_reviews = ?, total_correct = ?,
          combat_wins = ?, combat_losses = ?, created_at = ?
         WHERE id = 1`,
      )
      .run(
        player.name,
        player.class,
        player.level,
        player.xp,
        player.hp,
        player.maxHp,
        player.attack,
        player.defense,
        player.gold,
        player.streakDays,
        player.longestStreak,
        player.lastReviewDate,
        player.shieldCount,
        player.totalReviews,
        player.totalCorrect,
        player.combatWins,
        player.combatLosses,
        player.createdAt,
      );
  }

  addGold(amount: number): void {
    this.db
      .prepare("UPDATE player SET gold = gold + ? WHERE id = 1")
      .run(amount);
  }

  removeGold(amount: number): void {
    this.db
      .prepare("UPDATE player SET gold = MAX(0, gold - ?) WHERE id = 1")
      .run(amount);
  }
}
