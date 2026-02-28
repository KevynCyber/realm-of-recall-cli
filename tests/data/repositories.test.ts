import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../src/data/database.js";
import { CardRepository } from "../../src/data/repositories/CardRepository.js";
import { StatsRepository } from "../../src/data/repositories/StatsRepository.js";
import { AnswerQuality, CardType, type Card, type Deck } from "../../src/types/index.js";

let db: Database.Database;
let cardRepo: CardRepository;
let statsRepo: StatsRepository;

const testDeck: Deck = {
  id: "deck1",
  name: "Test Deck",
  description: "For testing",
  createdAt: new Date().toISOString(),
};

const testCard: Card = {
  id: "card1",
  front: "Capital of France?",
  back: "Paris",
  acceptableAnswers: ["Paris"],
  type: CardType.Basic,
  deckId: "deck1",
};

beforeEach(() => {
  db = getInMemoryDatabase();
  cardRepo = new CardRepository(db);
  statsRepo = new StatsRepository(db);
  cardRepo.createDeck(testDeck);
});

describe("CardRepository", () => {
  it("creates and retrieves a deck", () => {
    const deck = cardRepo.getDeck("deck1");
    expect(deck?.name).toBe("Test Deck");
  });

  it("lists all decks", () => {
    const decks = cardRepo.getAllDecks();
    expect(decks).toHaveLength(1);
  });

  it("inserts and retrieves a card", () => {
    cardRepo.insertCard(testCard);
    const card = cardRepo.getCard("card1");
    expect(card?.front).toBe("Capital of France?");
    expect(card?.acceptableAnswers).toEqual(["Paris"]);
  });

  it("inserts multiple cards in a transaction", () => {
    const cards: Card[] = [
      { ...testCard, id: "c1" },
      { ...testCard, id: "c2" },
      { ...testCard, id: "c3" },
    ];
    cardRepo.insertCards(cards);
    expect(cardRepo.getCardsByDeck("deck1")).toHaveLength(3);
  });

  it("counts cards in a deck", () => {
    cardRepo.insertCards([
      { ...testCard, id: "c1" },
      { ...testCard, id: "c2" },
    ]);
    expect(cardRepo.getCardCount("deck1")).toBe(2);
  });

  it("deletes a deck and cascades to cards", () => {
    cardRepo.insertCard(testCard);
    cardRepo.deleteDeck("deck1");
    expect(cardRepo.getDeck("deck1")).toBeUndefined();
    expect(cardRepo.getCard("card1")).toBeUndefined();
  });
});

describe("StatsRepository", () => {
  beforeEach(() => {
    cardRepo.insertCard(testCard);
  });

  it("records an attempt and updates schedule", () => {
    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now(),
        responseTime: 2.5,
        quality: AnswerQuality.Correct,
        wasTimed: false,
      },
      {
        cardId: "card1",
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
      },
    );

    const schedule = statsRepo.getSchedule("card1");
    expect(schedule?.repetitions).toBe(1);
    expect(schedule?.intervalDays).toBe(1);
  });

  it("returns due card IDs", () => {
    // Card with no stats = due for review
    const due = statsRepo.getDueCardIds();
    expect(due).toContain("card1");
  });

  it("retrieves attempts for a card", () => {
    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now(),
        responseTime: 2,
        quality: AnswerQuality.Perfect,
        wasTimed: false,
      },
      {
        cardId: "card1",
        easeFactor: 2.6,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: new Date().toISOString(),
      },
    );

    const attempts = statsRepo.getAttempts("card1");
    expect(attempts).toHaveLength(1);
    expect(attempts[0].quality).toBe(AnswerQuality.Perfect);
  });

  it("tracks total reviewed and attempts", () => {
    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now(),
        responseTime: 2,
        quality: AnswerQuality.Correct,
        wasTimed: false,
      },
      {
        cardId: "card1",
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: new Date().toISOString(),
      },
    );

    expect(statsRepo.getTotalReviewed()).toBe(1);
    expect(statsRepo.getTotalAttempts()).toBe(1);
  });
});
