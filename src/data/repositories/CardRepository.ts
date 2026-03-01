import type Database from "better-sqlite3";
import type { Card, Deck } from "../../types/index.js";
import { CardType } from "../../types/index.js";

export class CardRepository {
  constructor(private db: Database.Database) {}

  createDeck(deck: Deck): void {
    this.db
      .prepare(
        "INSERT INTO decks (id, name, description, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(deck.id, deck.name, deck.description, deck.createdAt);
  }

  getDeck(id: string): Deck | undefined {
    const row = this.db.prepare("SELECT * FROM decks WHERE id = ?").get(id) as
      | any
      | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      equipped: row.equipped === 1,
    };
  }

  getAllDecks(): Deck[] {
    const rows = this.db
      .prepare("SELECT * FROM decks ORDER BY created_at DESC")
      .all() as any[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      equipped: row.equipped === 1,
    }));
  }

  getEquippedDeckIds(): string[] {
    const rows = this.db
      .prepare("SELECT id FROM decks WHERE equipped = 1")
      .all() as any[];
    return rows.map((row) => row.id);
  }

  toggleDeckEquipped(deckId: string): void {
    this.db
      .prepare("UPDATE decks SET equipped = CASE WHEN equipped = 1 THEN 0 ELSE 1 END WHERE id = ?")
      .run(deckId);
  }

  deleteDeck(id: string): void {
    this.db.prepare("DELETE FROM decks WHERE id = ?").run(id);
  }

  insertCard(card: Card): void {
    this.db
      .prepare(
        "INSERT INTO cards (id, front, back, acceptable_answers, type, deck_id) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        card.id,
        card.front,
        card.back,
        JSON.stringify(card.acceptableAnswers),
        card.type,
        card.deckId,
      );
  }

  insertCards(cards: Card[]): void {
    const insert = this.db.prepare(
      "INSERT INTO cards (id, front, back, acceptable_answers, type, deck_id) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const tx = this.db.transaction((cards: Card[]) => {
      for (const card of cards) {
        insert.run(
          card.id,
          card.front,
          card.back,
          JSON.stringify(card.acceptableAnswers),
          card.type,
          card.deckId,
        );
      }
    });
    tx(cards);
  }

  getCard(id: string): Card | undefined {
    const row = this.db
      .prepare("SELECT * FROM cards WHERE id = ?")
      .get(id) as any | undefined;
    if (!row) return undefined;
    return this.rowToCard(row);
  }

  getCardsByDeck(deckId: string): Card[] {
    const rows = this.db
      .prepare("SELECT * FROM cards WHERE deck_id = ?")
      .all(deckId) as any[];
    return rows.map(this.rowToCard);
  }

  getCardCount(deckId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM cards WHERE deck_id = ?")
      .get(deckId) as any;
    return row.count;
  }

  getAllCards(): Card[] {
    const rows = this.db.prepare("SELECT * FROM cards").all() as any[];
    return rows.map(this.rowToCard);
  }

  getCardsByIds(ids: string[]): Card[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db
      .prepare(`SELECT * FROM cards WHERE id IN (${placeholders})`)
      .all(...ids) as any[];
    return rows.map(this.rowToCard);
  }

  private rowToCard(row: any): Card {
    return {
      id: row.id,
      front: row.front,
      back: row.back,
      acceptableAnswers: JSON.parse(row.acceptable_answers),
      type: row.type as CardType,
      deckId: row.deck_id,
    };
  }
}
