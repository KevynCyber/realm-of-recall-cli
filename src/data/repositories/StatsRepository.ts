import type Database from "better-sqlite3";
import type { RecallAttempt, ScheduleData } from "../../types/index.js";
import { AnswerQuality } from "../../types/index.js";

export class StatsRepository {
  constructor(private db: Database.Database) {}

  ensureStatsExist(cardId: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO recall_stats (card_id) VALUES (?)`,
      )
      .run(cardId);
  }

  recordAttempt(
    cardId: string,
    attempt: RecallAttempt,
    schedule: ScheduleData,
  ): void {
    const tx = this.db.transaction(() => {
      // Insert attempt
      this.db
        .prepare(
          `INSERT INTO recall_attempts (card_id, timestamp, response_time, quality, was_timed)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          cardId,
          attempt.timestamp,
          attempt.responseTime,
          attempt.quality,
          attempt.wasTimed ? 1 : 0,
        );

      // Determine if correct
      const correct =
        attempt.quality === AnswerQuality.Perfect ||
        attempt.quality === AnswerQuality.Correct ||
        attempt.quality === AnswerQuality.Partial;

      // Upsert stats
      this.ensureStatsExist(cardId);

      if (correct) {
        this.db
          .prepare(
            `UPDATE recall_stats SET
              total_attempts = total_attempts + 1,
              correct_count = correct_count + 1,
              consecutive_correct = consecutive_correct + 1,
              best_streak = MAX(best_streak, consecutive_correct + 1),
              total_response_time = total_response_time + ?,
              ease_factor = ?,
              interval_days = ?,
              repetitions = ?,
              next_review_at = ?
            WHERE card_id = ?`,
          )
          .run(
            attempt.responseTime,
            schedule.easeFactor,
            schedule.intervalDays,
            schedule.repetitions,
            schedule.nextReviewAt,
            cardId,
          );
      } else {
        this.db
          .prepare(
            `UPDATE recall_stats SET
              total_attempts = total_attempts + 1,
              consecutive_correct = 0,
              total_response_time = total_response_time + ?,
              ease_factor = ?,
              interval_days = ?,
              repetitions = ?,
              next_review_at = ?
            WHERE card_id = ?`,
          )
          .run(
            attempt.responseTime,
            schedule.easeFactor,
            schedule.intervalDays,
            schedule.repetitions,
            schedule.nextReviewAt,
            cardId,
          );
      }
    });

    tx();
  }

  getSchedule(cardId: string): ScheduleData | undefined {
    const row = this.db
      .prepare(
        "SELECT ease_factor, interval_days, repetitions, next_review_at FROM recall_stats WHERE card_id = ?",
      )
      .get(cardId) as any | undefined;
    if (!row) return undefined;
    return {
      cardId,
      easeFactor: row.ease_factor,
      intervalDays: row.interval_days,
      repetitions: row.repetitions,
      nextReviewAt: row.next_review_at,
    };
  }

  getDueCardIds(deckId?: string): string[] {
    const now = new Date().toISOString();
    let query: string;
    let params: any[];

    if (deckId) {
      query = `
        SELECT c.id FROM cards c
        LEFT JOIN recall_stats rs ON rs.card_id = c.id
        WHERE c.deck_id = ?
          AND (rs.next_review_at IS NULL OR rs.next_review_at <= ?)
        ORDER BY rs.next_review_at ASC
      `;
      params = [deckId, now];
    } else {
      query = `
        SELECT c.id FROM cards c
        LEFT JOIN recall_stats rs ON rs.card_id = c.id
        WHERE rs.next_review_at IS NULL OR rs.next_review_at <= ?
        ORDER BY rs.next_review_at ASC
      `;
      params = [now];
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => r.id);
  }

  getAttempts(cardId: string): RecallAttempt[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM recall_attempts WHERE card_id = ? ORDER BY timestamp ASC",
      )
      .all(cardId) as any[];
    return rows.map((r) => ({
      cardId: r.card_id,
      timestamp: r.timestamp,
      responseTime: r.response_time,
      quality: r.quality as AnswerQuality,
      wasTimed: r.was_timed === 1,
    }));
  }

  getTotalReviewed(): number {
    const row = this.db
      .prepare("SELECT COUNT(DISTINCT card_id) as count FROM recall_attempts")
      .get() as any;
    return row.count;
  }

  getTotalAttempts(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM recall_attempts")
      .get() as any;
    return row.count;
  }
}
