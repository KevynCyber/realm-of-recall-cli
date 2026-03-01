import type Database from "better-sqlite3";
import type { RecallAttempt, ScheduleData } from "../../types/index.js";
import { AnswerQuality, ConfidenceLevel } from "../../types/index.js";

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
    evolutionTier?: number,
  ): void {
    const tx = this.db.transaction(() => {
      // Insert attempt
      this.db
        .prepare(
          `INSERT INTO recall_attempts (card_id, timestamp, response_time, quality, was_timed, confidence, retrieval_mode, response_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          cardId,
          attempt.timestamp,
          attempt.responseTime,
          attempt.quality,
          attempt.wasTimed ? 1 : 0,
          attempt.confidence ?? null,
          attempt.retrievalMode ?? "standard",
          attempt.responseText ?? null,
        );

      // Determine if correct
      const correct =
        attempt.quality === AnswerQuality.Perfect ||
        attempt.quality === AnswerQuality.Correct ||
        attempt.quality === AnswerQuality.Partial;

      // Determine gap_streak change
      let gapStreakExpr: string;
      if (correct && attempt.confidence === ConfidenceLevel.Guess) {
        gapStreakExpr = "gap_streak + 1";
      } else {
        gapStreakExpr = "0";
      }

      // Determine evolution_tier update
      const evolutionTierExpr =
        evolutionTier !== undefined ? "?" : "evolution_tier";

      // Upsert stats
      this.ensureStatsExist(cardId);

      if (correct) {
        const sql = `UPDATE recall_stats SET
              total_attempts = total_attempts + 1,
              correct_count = correct_count + 1,
              consecutive_correct = consecutive_correct + 1,
              best_streak = MAX(best_streak, consecutive_correct + 1),
              total_response_time = total_response_time + ?,
              difficulty = ?,
              stability = ?,
              repetitions = ?,
              lapses = ?,
              card_state = ?,
              last_review_at = ?,
              next_review_at = ?,
              gap_streak = ${gapStreakExpr},
              evolution_tier = ${evolutionTierExpr}
            WHERE card_id = ?`;

        const params: any[] = [
          attempt.responseTime,
          schedule.difficulty,
          schedule.stability,
          schedule.reps,
          schedule.lapses,
          schedule.state,
          schedule.lastReview,
          schedule.due,
        ];
        if (evolutionTier !== undefined) {
          params.push(evolutionTier);
        }
        params.push(cardId);

        this.db.prepare(sql).run(...params);
      } else {
        const sql = `UPDATE recall_stats SET
              total_attempts = total_attempts + 1,
              consecutive_correct = 0,
              total_response_time = total_response_time + ?,
              difficulty = ?,
              stability = ?,
              repetitions = ?,
              lapses = ?,
              card_state = ?,
              last_review_at = ?,
              next_review_at = ?,
              gap_streak = 0,
              evolution_tier = ${evolutionTierExpr}
            WHERE card_id = ?`;

        const params: any[] = [
          attempt.responseTime,
          schedule.difficulty,
          schedule.stability,
          schedule.reps,
          schedule.lapses,
          schedule.state,
          schedule.lastReview,
          schedule.due,
        ];
        if (evolutionTier !== undefined) {
          params.push(evolutionTier);
        }
        params.push(cardId);

        this.db.prepare(sql).run(...params);
      }
    });

    tx();
  }

  getSchedule(
    cardId: string,
  ): (ScheduleData & { evolutionTier: number; gapStreak: number }) | undefined {
    const row = this.db
      .prepare(
        `SELECT difficulty, stability, repetitions, lapses, card_state, last_review_at, next_review_at, evolution_tier, gap_streak
         FROM recall_stats WHERE card_id = ?`,
      )
      .get(cardId) as any | undefined;
    if (!row) return undefined;
    return {
      cardId,
      difficulty: row.difficulty,
      stability: row.stability,
      reps: row.repetitions,
      lapses: row.lapses,
      state: row.card_state,
      due: row.next_review_at,
      lastReview: row.last_review_at,
      evolutionTier: row.evolution_tier,
      gapStreak: row.gap_streak,
    };
  }

  getCardEvolutionTier(cardId: string): number {
    const row = this.db
      .prepare(`SELECT evolution_tier FROM recall_stats WHERE card_id = ?`)
      .get(cardId) as any | undefined;
    return row ? row.evolution_tier : 0;
  }

  getCardEvolutionStats(cardId: string): {
    consecutiveCorrect: number;
    currentTier: number;
    fsrsState: string;
    stability: number;
    lapses: number;
  } {
    const row = this.db
      .prepare(
        `SELECT consecutive_correct, evolution_tier, card_state, stability, lapses
         FROM recall_stats WHERE card_id = ?`,
      )
      .get(cardId) as any | undefined;
    if (!row) {
      return { consecutiveCorrect: 0, currentTier: 0, fsrsState: "new", stability: 0, lapses: 0 };
    }
    return {
      consecutiveCorrect: row.consecutive_correct,
      currentTier: row.evolution_tier,
      fsrsState: row.card_state,
      stability: row.stability,
      lapses: row.lapses,
    };
  }

  getCardGapStreak(cardId: string): number {
    const row = this.db
      .prepare(`SELECT gap_streak FROM recall_stats WHERE card_id = ?`)
      .get(cardId) as any | undefined;
    return row ? row.gap_streak : 0;
  }

  getRecentQualities(cardId: string, limit = 5): string[] {
    const rows = this.db
      .prepare(
        `SELECT quality FROM recall_attempts WHERE card_id = ? ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(cardId, limit) as any[];
    return rows.map((r) => r.quality);
  }

  getRecentModes(cardId: string, limit = 5): string[] {
    const rows = this.db
      .prepare(
        `SELECT retrieval_mode FROM recall_attempts WHERE card_id = ? ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(cardId, limit) as any[];
    return rows.map((r) => r.retrieval_mode);
  }

  getAccuracyHistory(limit = 14): number[] {
    const rows = this.db
      .prepare(
        `SELECT date(timestamp/1000, 'unixepoch') as day,
                CAST(SUM(CASE WHEN quality IN ('perfect','correct','partial') THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as accuracy
         FROM recall_attempts
         GROUP BY day
         ORDER BY day DESC
         LIMIT ?`,
      )
      .all(limit) as any[];
    return rows.map((r) => r.accuracy);
  }

  getResponseTimeHistory(limit = 14): number[] {
    const rows = this.db
      .prepare(
        `SELECT date(timestamp/1000, 'unixepoch') as day,
                AVG(response_time) as avg_time
         FROM recall_attempts
         GROUP BY day
         ORDER BY day DESC
         LIMIT ?`,
      )
      .all(limit) as any[];
    return rows.map((r) => r.avg_time);
  }

  getDueCardIds(deckId?: string | string[]): string[] {
    const now = new Date().toISOString();
    let query: string;
    let params: any[];

    if (Array.isArray(deckId)) {
      if (deckId.length === 0) return [];
      const placeholders = deckId.map(() => "?").join(",");
      query = `
        SELECT c.id FROM cards c
        LEFT JOIN recall_stats rs ON rs.card_id = c.id
        WHERE c.deck_id IN (${placeholders})
          AND (rs.next_review_at IS NULL OR rs.next_review_at <= ?)
        ORDER BY rs.next_review_at ASC
      `;
      params = [...deckId, now];
    } else if (deckId) {
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

  getDueCards(deckId?: string | string[], limit?: number): string[] {
    const now = new Date().toISOString();
    const effectiveLimit = limit ?? 9999;

    if (Array.isArray(deckId)) {
      if (deckId.length === 0) return [];
      const placeholders = deckId.map(() => "?").join(",");
      const query = `
        SELECT id FROM (
          SELECT c.id, rs.next_review_at FROM cards c
          JOIN recall_stats rs ON rs.card_id = c.id
          WHERE c.deck_id IN (${placeholders})
            AND rs.card_state != 'new'
            AND rs.next_review_at <= ?
          UNION ALL
          SELECT c.id, NULL as next_review_at FROM cards c
          LEFT JOIN recall_stats rs ON rs.card_id = c.id
          WHERE c.deck_id IN (${placeholders})
            AND (rs.card_state IS NULL OR rs.card_state = 'new')
        )
        ORDER BY next_review_at ASC
        LIMIT ?
      `;
      const rows = this.db.prepare(query).all(...deckId, now, ...deckId, effectiveLimit) as any[];
      return rows.map((r) => r.id);
    } else if (deckId) {
      const query = `
        SELECT id FROM (
          SELECT c.id, rs.next_review_at FROM cards c
          JOIN recall_stats rs ON rs.card_id = c.id
          WHERE c.deck_id = ?
            AND rs.card_state != 'new'
            AND rs.next_review_at <= ?
          UNION ALL
          SELECT c.id, NULL as next_review_at FROM cards c
          LEFT JOIN recall_stats rs ON rs.card_id = c.id
          WHERE c.deck_id = ?
            AND (rs.card_state IS NULL OR rs.card_state = 'new')
        )
        ORDER BY next_review_at ASC
        LIMIT ?
      `;
      const rows = this.db.prepare(query).all(deckId, now, deckId, effectiveLimit) as any[];
      return rows.map((r) => r.id);
    } else {
      const query = `
        SELECT id FROM (
          SELECT c.id, rs.next_review_at FROM cards c
          JOIN recall_stats rs ON rs.card_id = c.id
          WHERE rs.card_state != 'new'
            AND rs.next_review_at <= ?
          UNION ALL
          SELECT c.id, NULL as next_review_at FROM cards c
          LEFT JOIN recall_stats rs ON rs.card_id = c.id
          WHERE rs.card_state IS NULL OR rs.card_state = 'new'
        )
        ORDER BY next_review_at ASC
        LIMIT ?
      `;
      const rows = this.db.prepare(query).all(now, effectiveLimit) as any[];
      return rows.map((r) => r.id);
    }
  }

  getCardsByState(deckId: string, state: string): string[] {
    // Cards with no recall_stats row are implicitly 'new'
    if (state === "new") {
      const rows = this.db
        .prepare(
          `SELECT c.id FROM cards c
           LEFT JOIN recall_stats rs ON rs.card_id = c.id
           WHERE c.deck_id = ?
             AND (rs.card_state IS NULL OR rs.card_state = 'new')`,
        )
        .all(deckId) as any[];
      return rows.map((r) => r.id);
    }

    const rows = this.db
      .prepare(
        `SELECT c.id FROM cards c
         JOIN recall_stats rs ON rs.card_id = c.id
         WHERE c.deck_id = ? AND rs.card_state = ?`,
      )
      .all(deckId, state) as any[];
    return rows.map((r) => r.id);
  }

  getDeckMasteryStats(deckId: string): {
    total: number;
    newCount: number;
    learningCount: number;
    reviewCount: number;
    relearnCount: number;
  } {
    const totalRow = this.db
      .prepare("SELECT COUNT(*) as count FROM cards WHERE deck_id = ?")
      .get(deckId) as any;
    const total = totalRow.count;

    const statsRows = this.db
      .prepare(
        `SELECT rs.card_state, COUNT(*) as count
         FROM cards c
         JOIN recall_stats rs ON rs.card_id = c.id
         WHERE c.deck_id = ?
         GROUP BY rs.card_state`,
      )
      .all(deckId) as any[];

    const counts: Record<string, number> = {};
    for (const row of statsRows) {
      counts[row.card_state] = row.count;
    }

    // Cards without recall_stats are 'new'
    const trackedCount = statsRows.reduce((sum: number, r: any) => sum + r.count, 0);
    const untrackedNew = total - trackedCount;

    return {
      total,
      newCount: (counts["new"] ?? 0) + untrackedNew,
      learningCount: counts["learning"] ?? 0,
      reviewCount: counts["review"] ?? 0,
      relearnCount: counts["relearning"] ?? 0,
    };
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
