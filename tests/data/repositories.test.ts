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
});

describe("CardRepository", () => {
  it("creates and retrieves a deck", () => {
    const deck = cardRepo.getDeck("deck1");
    expect(deck?.name).toBe("Test Deck");
  });

  it("lists all decks", () => {
    const decks = cardRepo.getAllDecks();
    expect(decks).toHaveLength(1);
    expect(decks[0].equipped).toBe(true);
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

  describe("equipped deck management", () => {
    it("returns equipped deck IDs", () => {
      const ids = cardRepo.getEquippedDeckIds();
      expect(ids).toContain("deck1");
    });

    it("toggles deck equipped off", () => {
      cardRepo.toggleDeckEquipped("deck1");
      const deck = cardRepo.getDeck("deck1");
      expect(deck?.equipped).toBe(false);
      expect(cardRepo.getEquippedDeckIds()).toHaveLength(0);
    });

    it("toggles deck equipped back on", () => {
      cardRepo.toggleDeckEquipped("deck1");
      cardRepo.toggleDeckEquipped("deck1");
      const deck = cardRepo.getDeck("deck1");
      expect(deck?.equipped).toBe(true);
    });

    it("filters equipped deck IDs with multiple decks", () => {
      cardRepo.createDeck({ id: "deck2", name: "Deck 2", description: "", createdAt: new Date().toISOString(), equipped: true });
      cardRepo.createDeck({ id: "deck3", name: "Deck 3", description: "", createdAt: new Date().toISOString(), equipped: true });
      cardRepo.toggleDeckEquipped("deck2"); // unequip deck2
      const ids = cardRepo.getEquippedDeckIds();
      expect(ids).toContain("deck1");
      expect(ids).not.toContain("deck2");
      expect(ids).toContain("deck3");
    });
  });
});

describe("StatsRepository", () => {
  beforeEach(() => {
    cardRepo.insertCard(testCard);
  });

  it("records an attempt and updates schedule", () => {
    const schedule = makeSchedule({ reps: 1 });

    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now(),
        responseTime: 2.5,
        quality: AnswerQuality.Correct,
        wasTimed: false,
      },
      schedule,
    );

    const retrieved = statsRepo.getSchedule("card1");
    expect(retrieved?.reps).toBe(1);
    expect(retrieved?.state).toBe("learning");
    expect(retrieved?.difficulty).toBe(5.0);
    expect(retrieved?.stability).toBe(1.0);
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
      makeSchedule(),
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
      makeSchedule(),
    );

    expect(statsRepo.getTotalReviewed()).toBe(1);
    expect(statsRepo.getTotalAttempts()).toBe(1);
  });

  describe("FSRS field storage and retrieval", () => {
    it("stores and retrieves all FSRS fields", () => {
      const schedule = makeSchedule({
        cardId: "card1",
        difficulty: 7.2,
        stability: 14.5,
        reps: 5,
        lapses: 2,
        state: "review",
        due: "2026-03-15T10:00:00.000Z",
        lastReview: "2026-02-28T10:00:00.000Z",
      });

      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 3.0,
          quality: AnswerQuality.Perfect,
          wasTimed: false,
        },
        schedule,
      );

      const retrieved = statsRepo.getSchedule("card1");
      expect(retrieved).toBeDefined();
      expect(retrieved!.cardId).toBe("card1");
      expect(retrieved!.difficulty).toBe(7.2);
      expect(retrieved!.stability).toBe(14.5);
      expect(retrieved!.reps).toBe(5);
      expect(retrieved!.lapses).toBe(2);
      expect(retrieved!.state).toBe("review");
      expect(retrieved!.due).toBe("2026-03-15T10:00:00.000Z");
      expect(retrieved!.lastReview).toBe("2026-02-28T10:00:00.000Z");
    });

    it("updates FSRS fields on subsequent attempts", () => {
      // First attempt: learning
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule({ state: "learning", stability: 1.0, difficulty: 5.0 }),
      );

      let retrieved = statsRepo.getSchedule("card1");
      expect(retrieved!.state).toBe("learning");

      // Second attempt: promoted to review
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 1.5,
          quality: AnswerQuality.Perfect,
          wasTimed: false,
        },
        makeSchedule({ state: "review", stability: 10.0, difficulty: 4.5, reps: 2 }),
      );

      retrieved = statsRepo.getSchedule("card1");
      expect(retrieved!.state).toBe("review");
      expect(retrieved!.stability).toBe(10.0);
      expect(retrieved!.difficulty).toBe(4.5);
      expect(retrieved!.reps).toBe(2);
    });

    it("tracks lapses on incorrect answers", () => {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 5.0,
          quality: AnswerQuality.Wrong,
          wasTimed: false,
        },
        makeSchedule({ state: "relearning", lapses: 1, stability: 0.5 }),
      );

      const retrieved = statsRepo.getSchedule("card1");
      expect(retrieved!.state).toBe("relearning");
      expect(retrieved!.lapses).toBe(1);
      expect(retrieved!.stability).toBe(0.5);
    });

    it("returns undefined for card with no stats", () => {
      const schedule = statsRepo.getSchedule("nonexistent-card");
      expect(schedule).toBeUndefined();
    });
  });

  describe("getCardsByState", () => {
    beforeEach(() => {
      // Insert additional cards
      cardRepo.insertCards([
        { ...testCard, id: "card2" },
        { ...testCard, id: "card3" },
        { ...testCard, id: "card4" },
      ]);
    });

    it("returns new cards (no stats row)", () => {
      // Cards with no stats should be treated as 'new'
      const newCards = statsRepo.getCardsByState("deck1", "new");
      expect(newCards).toContain("card1");
      expect(newCards).toContain("card2");
      expect(newCards).toContain("card3");
      expect(newCards).toContain("card4");
      expect(newCards).toHaveLength(4);
    });

    it("returns new cards (with stats row in 'new' state)", () => {
      statsRepo.ensureStatsExist("card1");
      const newCards = statsRepo.getCardsByState("deck1", "new");
      expect(newCards).toContain("card1");
    });

    it("returns learning cards", () => {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card1", state: "learning" }),
      );

      const learningCards = statsRepo.getCardsByState("deck1", "learning");
      expect(learningCards).toContain("card1");
      expect(learningCards).toHaveLength(1);
    });

    it("returns review cards", () => {
      statsRepo.recordAttempt(
        "card2",
        {
          cardId: "card2",
          timestamp: Date.now(),
          responseTime: 1.5,
          quality: AnswerQuality.Perfect,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card2", state: "review" }),
      );

      const reviewCards = statsRepo.getCardsByState("deck1", "review");
      expect(reviewCards).toContain("card2");
      expect(reviewCards).toHaveLength(1);
    });

    it("returns relearning cards", () => {
      statsRepo.recordAttempt(
        "card3",
        {
          cardId: "card3",
          timestamp: Date.now(),
          responseTime: 5.0,
          quality: AnswerQuality.Wrong,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card3", state: "relearning", lapses: 1 }),
      );

      const relearnCards = statsRepo.getCardsByState("deck1", "relearning");
      expect(relearnCards).toContain("card3");
      expect(relearnCards).toHaveLength(1);
    });

    it("does not return cards from other decks", () => {
      cardRepo.createDeck({ id: "deck2", name: "Other Deck", description: "", createdAt: new Date().toISOString(), equipped: true });
      cardRepo.insertCard({ ...testCard, id: "other-card", deckId: "deck2" });

      statsRepo.recordAttempt(
        "other-card",
        {
          cardId: "other-card",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule({ cardId: "other-card", state: "learning" }),
      );

      const learningCards = statsRepo.getCardsByState("deck1", "learning");
      expect(learningCards).not.toContain("other-card");
    });
  });

  describe("getDueCards", () => {
    beforeEach(() => {
      cardRepo.insertCards([
        { ...testCard, id: "card2" },
        { ...testCard, id: "card3" },
      ]);
    });

    it("returns new cards (no stats) as due", () => {
      const due = statsRepo.getDueCards("deck1");
      expect(due).toContain("card1");
      expect(due).toContain("card2");
      expect(due).toContain("card3");
    });

    it("returns cards with past due dates", () => {
      const pastDue = new Date(Date.now() - 86400000).toISOString();
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card1", state: "review", due: pastDue }),
      );

      const due = statsRepo.getDueCards("deck1");
      expect(due).toContain("card1");
    });

    it("excludes cards with future due dates (non-new)", () => {
      const futureDue = new Date(Date.now() + 86400000 * 7).toISOString();
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Perfect,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card1", state: "review", due: futureDue }),
      );

      const due = statsRepo.getDueCards("deck1");
      expect(due).not.toContain("card1");
      // card2 and card3 still due (new)
      expect(due).toContain("card2");
      expect(due).toContain("card3");
    });

    it("respects limit parameter", () => {
      const due = statsRepo.getDueCards("deck1", 2);
      expect(due).toHaveLength(2);
    });

    it("works without deckId (all decks)", () => {
      const due = statsRepo.getDueCards();
      expect(due.length).toBeGreaterThanOrEqual(3);
    });

    it("includes new cards with stats row in 'new' state", () => {
      statsRepo.ensureStatsExist("card1");
      const due = statsRepo.getDueCards("deck1");
      expect(due).toContain("card1");
    });

    it("filters by multiple deck IDs (string[])", () => {
      cardRepo.createDeck({ id: "deck2", name: "Deck 2", description: "", createdAt: new Date().toISOString(), equipped: true });
      cardRepo.insertCards([
        { ...testCard, id: "d2c1", deckId: "deck2" },
        { ...testCard, id: "d2c2", deckId: "deck2" },
      ]);

      // Should include cards from both decks
      const due = statsRepo.getDueCards(["deck1", "deck2"]);
      expect(due).toContain("card1");
      expect(due).toContain("d2c1");
      expect(due).toContain("d2c2");
    });

    it("excludes decks not in the array", () => {
      cardRepo.createDeck({ id: "deck2", name: "Deck 2", description: "", createdAt: new Date().toISOString(), equipped: true });
      cardRepo.insertCard({ ...testCard, id: "d2c1", deckId: "deck2" });

      // Only request deck1 cards
      const due = statsRepo.getDueCards(["deck1"]);
      expect(due).toContain("card1");
      expect(due).not.toContain("d2c1");
    });

    it("returns empty array for empty deck ID array", () => {
      const due = statsRepo.getDueCards([]);
      expect(due).toHaveLength(0);
    });

    it("getDueCardIds filters by multiple deck IDs", () => {
      cardRepo.createDeck({ id: "deck2", name: "Deck 2", description: "", createdAt: new Date().toISOString(), equipped: true });
      cardRepo.insertCard({ ...testCard, id: "d2c1", deckId: "deck2" });

      const due = statsRepo.getDueCardIds(["deck1", "deck2"]);
      expect(due).toContain("card1");
      expect(due).toContain("d2c1");

      const dueOnlyDeck1 = statsRepo.getDueCardIds(["deck1"]);
      expect(dueOnlyDeck1).toContain("card1");
      expect(dueOnlyDeck1).not.toContain("d2c1");
    });
  });

  describe("getDeckMasteryStats", () => {
    beforeEach(() => {
      cardRepo.insertCards([
        { ...testCard, id: "card2" },
        { ...testCard, id: "card3" },
        { ...testCard, id: "card4" },
        { ...testCard, id: "card5" },
      ]);
    });

    it("returns all cards as new when no reviews done", () => {
      const stats = statsRepo.getDeckMasteryStats("deck1");
      expect(stats.total).toBe(5);
      expect(stats.newCount).toBe(5);
      expect(stats.learningCount).toBe(0);
      expect(stats.reviewCount).toBe(0);
      expect(stats.relearnCount).toBe(0);
    });

    it("counts cards in each state correctly", () => {
      // card1 -> learning
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card1", state: "learning" }),
      );

      // card2 -> review
      statsRepo.recordAttempt(
        "card2",
        {
          cardId: "card2",
          timestamp: Date.now(),
          responseTime: 1.5,
          quality: AnswerQuality.Perfect,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card2", state: "review" }),
      );

      // card3 -> relearning
      statsRepo.recordAttempt(
        "card3",
        {
          cardId: "card3",
          timestamp: Date.now(),
          responseTime: 5.0,
          quality: AnswerQuality.Wrong,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card3", state: "relearning", lapses: 1 }),
      );

      // card4, card5 -> still new (no stats)

      const stats = statsRepo.getDeckMasteryStats("deck1");
      expect(stats.total).toBe(5);
      expect(stats.newCount).toBe(2);
      expect(stats.learningCount).toBe(1);
      expect(stats.reviewCount).toBe(1);
      expect(stats.relearnCount).toBe(1);
    });

    it("returns zeros for empty deck", () => {
      cardRepo.createDeck({ id: "empty", name: "Empty", description: "", createdAt: new Date().toISOString(), equipped: true });
      const stats = statsRepo.getDeckMasteryStats("empty");
      expect(stats.total).toBe(0);
      expect(stats.newCount).toBe(0);
      expect(stats.learningCount).toBe(0);
      expect(stats.reviewCount).toBe(0);
      expect(stats.relearnCount).toBe(0);
    });

    it("does not count cards from other decks", () => {
      cardRepo.createDeck({ id: "deck2", name: "Deck2", description: "", createdAt: new Date().toISOString(), equipped: true });
      cardRepo.insertCard({ ...testCard, id: "other-card", deckId: "deck2" });
      statsRepo.recordAttempt(
        "other-card",
        {
          cardId: "other-card",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule({ cardId: "other-card", state: "review" }),
      );

      const stats = statsRepo.getDeckMasteryStats("deck1");
      expect(stats.total).toBe(5);
      expect(stats.reviewCount).toBe(0);
    });
  });
});
