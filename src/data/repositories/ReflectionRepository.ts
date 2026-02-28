import type Database from "better-sqlite3";

export interface Reflection {
  id: string;
  sessionType: "combat" | "review";
  createdAt?: string;
  difficultyRating: 1 | 2 | 3;
  journalEntry?: string;
  promptUsed?: string;
  accuracy: number;
  cardsReviewed: number;
  deckId?: string;
}

export class ReflectionRepository {
  constructor(private db: Database.Database) {}

  saveReflection(reflection: {
    id: string;
    sessionType: "combat" | "review";
    difficultyRating: 1 | 2 | 3;
    journalEntry?: string;
    promptUsed?: string;
    accuracy: number;
    cardsReviewed: number;
    deckId?: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO session_reflections (id, session_type, difficulty_rating, journal_entry, prompt_used, accuracy, cards_reviewed, deck_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        reflection.id,
        reflection.sessionType,
        reflection.difficultyRating,
        reflection.journalEntry ?? null,
        reflection.promptUsed ?? null,
        reflection.accuracy,
        reflection.cardsReviewed,
        reflection.deckId ?? null,
      );
  }

  getRecentReflections(
    limit: number = 20,
  ): Reflection[] {
    const rows = this.db
      .prepare(
        `SELECT id, session_type, created_at, difficulty_rating, journal_entry, prompt_used, accuracy, cards_reviewed, deck_id
         FROM session_reflections
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit) as any[];

    return rows.map((row) => ({
      id: row.id as string,
      sessionType: row.session_type as "combat" | "review",
      createdAt: row.created_at as string,
      difficultyRating: row.difficulty_rating as 1 | 2 | 3,
      journalEntry: row.journal_entry as string | undefined,
      promptUsed: row.prompt_used as string | undefined,
      accuracy: row.accuracy as number,
      cardsReviewed: row.cards_reviewed as number,
      deckId: row.deck_id as string | undefined,
    }));
  }

  getReflectionCount(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM session_reflections")
      .get() as any;
    return row.count;
  }

  getRecentAccuracies(limit: number = 10): number[] {
    const rows = this.db
      .prepare(
        `SELECT accuracy FROM session_reflections ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as any[];
    return rows.map((row) => row.accuracy as number);
  }
}
