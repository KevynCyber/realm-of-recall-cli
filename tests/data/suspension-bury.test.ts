import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../src/data/database.js";
import { CardRepository } from "../../src/data/repositories/CardRepository.js";
import { StatsRepository } from "../../src/data/repositories/StatsRepository.js";
import { AnswerQuality, CardType, type Card, type Deck, type ScheduleData } from "../../src/types/index.js";

let db: Database.Database;
let cardRepo: CardRepository;
let statsRepo: StatsRepository;

const testDeck: Deck = {
  id: "deck1",
  name: "Test Deck",
  description: "For testing",
  createdAt: new Date().toISOString(),
  equipped: true,
};

const testCard: Card = {
  id: "card1",
  front: "Capital of France?",
  back: "Paris",
  acceptableAnswers: ["Paris"],
  type: CardType.Basic,
  deckId: "deck1",
};

function makeSchedule(overrides?: Partial<ScheduleData>): ScheduleData {
  return {
    cardId: "card1",
    difficulty: 5.0,
    stability: 1.0,
    reps: 1,
    lapses: 0,
    state: "learning",
    due: new Date(Date.now() + 86400000).toISOString(),
    lastReview: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  db = getInMemoryDatabase();
  cardRepo = new CardRepository(db);
  statsRepo = new StatsRepository(db);
  cardRepo.createDeck(testDeck);
  cardRepo.insertCard(testCard);
  cardRepo.insertCards([
    { ...testCard, id: "card2" },
    { ...testCard, id: "card3" },
  ]);
});

describe("Card Suspension", () => {
  it("suspendCard marks card as suspended", () => {
    statsRepo.suspendCard("card1");
    const row = db
      .prepare("SELECT suspended FROM recall_stats WHERE card_id = ?")
      .get("card1") as any;
    expect(row.suspended).toBe(1);
  });

  it("unsuspendCard marks card as not suspended", () => {
    statsRepo.suspendCard("card1");
    statsRepo.unsuspendCard("card1");
    const row = db
      .prepare("SELECT suspended FROM recall_stats WHERE card_id = ?")
      .get("card1") as any;
    expect(row.suspended).toBe(0);
  });

  it("suspended card is excluded from getDueCardIds", () => {
    statsRepo.suspendCard("card1");
    const due = statsRepo.getDueCardIds("deck1");
    expect(due).not.toContain("card1");
    expect(due).toContain("card2");
    expect(due).toContain("card3");
  });

  it("suspended card is excluded from getDueCards", () => {
    statsRepo.suspendCard("card1");
    const due = statsRepo.getDueCards("deck1");
    expect(due).not.toContain("card1");
    expect(due).toContain("card2");
    expect(due).toContain("card3");
  });

  it("suspended card is excluded from getDueCards with array deckId", () => {
    statsRepo.suspendCard("card1");
    const due = statsRepo.getDueCards(["deck1"]);
    expect(due).not.toContain("card1");
    expect(due).toContain("card2");
  });

  it("suspended card is excluded from getDueCards without deckId", () => {
    statsRepo.suspendCard("card1");
    const due = statsRepo.getDueCards();
    expect(due).not.toContain("card1");
    expect(due).toContain("card2");
  });

  it("unsuspended card reappears in due queue", () => {
    statsRepo.suspendCard("card1");
    statsRepo.unsuspendCard("card1");
    const due = statsRepo.getDueCardIds("deck1");
    expect(due).toContain("card1");
  });

  it("getSuspendedCount returns correct count", () => {
    expect(statsRepo.getSuspendedCount("deck1")).toBe(0);
    statsRepo.suspendCard("card1");
    expect(statsRepo.getSuspendedCount("deck1")).toBe(1);
    statsRepo.suspendCard("card2");
    expect(statsRepo.getSuspendedCount("deck1")).toBe(2);
  });

  it("unsuspendAll unsuspends all cards in a deck", () => {
    statsRepo.suspendCard("card1");
    statsRepo.suspendCard("card2");
    statsRepo.suspendCard("card3");
    expect(statsRepo.getSuspendedCount("deck1")).toBe(3);
    statsRepo.unsuspendAll("deck1");
    expect(statsRepo.getSuspendedCount("deck1")).toBe(0);
    const due = statsRepo.getDueCardIds("deck1");
    expect(due).toContain("card1");
    expect(due).toContain("card2");
    expect(due).toContain("card3");
  });

  it("unsuspendAll does not affect other decks", () => {
    cardRepo.createDeck({ id: "deck2", name: "Deck 2", description: "", createdAt: new Date().toISOString(), equipped: true });
    cardRepo.insertCard({ ...testCard, id: "d2c1", deckId: "deck2" });
    statsRepo.suspendCard("card1");
    statsRepo.suspendCard("d2c1");
    statsRepo.unsuspendAll("deck1");
    expect(statsRepo.getSuspendedCount("deck1")).toBe(0);
    expect(statsRepo.getSuspendedCount("deck2")).toBe(1);
  });

  it("suspended review card is excluded from getDueCardsWithNewLimit", () => {
    // Make card1 a review card
    const pastDue = new Date(Date.now() - 86400000).toISOString();
    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now() - 172800000,
        responseTime: 2.0,
        quality: AnswerQuality.Correct,
        wasTimed: false,
      },
      makeSchedule({ cardId: "card1", state: "review", due: pastDue }),
    );
    statsRepo.suspendCard("card1");
    const { cardIds } = statsRepo.getDueCardsWithNewLimit("deck1", 20);
    expect(cardIds).not.toContain("card1");
  });
});

describe("Card Bury", () => {
  it("buryCard sets buried_until to tomorrow", () => {
    statsRepo.buryCard("card1");
    const row = db
      .prepare("SELECT buried_until FROM recall_stats WHERE card_id = ?")
      .get("card1") as any;
    expect(row.buried_until).toBeDefined();
    const buriedDate = new Date(row.buried_until);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    expect(buriedDate.getTime()).toBe(tomorrow.getTime());
  });

  it("buried card is excluded from getDueCardIds", () => {
    statsRepo.buryCard("card1");
    const due = statsRepo.getDueCardIds("deck1");
    expect(due).not.toContain("card1");
    expect(due).toContain("card2");
  });

  it("buried card is excluded from getDueCards", () => {
    statsRepo.buryCard("card1");
    const due = statsRepo.getDueCards("deck1");
    expect(due).not.toContain("card1");
    expect(due).toContain("card2");
  });

  it("buried card is excluded from getDueCards with array deckId", () => {
    statsRepo.buryCard("card1");
    const due = statsRepo.getDueCards(["deck1"]);
    expect(due).not.toContain("card1");
  });

  it("buried card is excluded from getDueCards without deckId", () => {
    statsRepo.buryCard("card1");
    const due = statsRepo.getDueCards();
    expect(due).not.toContain("card1");
  });

  it("card with past buried_until reappears in due queue", () => {
    // Manually set buried_until to the past
    statsRepo.ensureStatsExist("card1");
    const past = new Date(Date.now() - 86400000).toISOString();
    db.prepare("UPDATE recall_stats SET buried_until = ? WHERE card_id = ?").run(past, "card1");
    const due = statsRepo.getDueCardIds("deck1");
    expect(due).toContain("card1");
  });

  it("buried card is excluded from getDueCardsWithNewLimit", () => {
    statsRepo.buryCard("card1");
    const { cardIds } = statsRepo.getDueCardsWithNewLimit("deck1", 20);
    expect(cardIds).not.toContain("card1");
  });
});

describe("Suspension and bury combined", () => {
  it("both suspended and buried cards are excluded", () => {
    statsRepo.suspendCard("card1");
    statsRepo.buryCard("card2");
    const due = statsRepo.getDueCardIds("deck1");
    expect(due).not.toContain("card1");
    expect(due).not.toContain("card2");
    expect(due).toContain("card3");
  });
});
