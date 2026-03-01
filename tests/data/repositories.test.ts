import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../src/data/database.js";
import { CardRepository } from "../../src/data/repositories/CardRepository.js";
import { StatsRepository } from "../../src/data/repositories/StatsRepository.js";
import { AnswerQuality, CardType, ConfidenceLevel, RetrievalMode, type Card, type Deck, type ScheduleData } from "../../src/types/index.js";

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

  describe("Ultra-Learner fields", () => {
    it("stores confidence correctly in recall_attempts", () => {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
          confidence: ConfidenceLevel.Knew,
        },
        makeSchedule(),
      );

      const row = db
        .prepare("SELECT confidence FROM recall_attempts WHERE card_id = ?")
        .get("card1") as any;
      expect(row.confidence).toBe("knew");
    });

    it("stores retrieval_mode correctly in recall_attempts", () => {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
          retrievalMode: RetrievalMode.Reversed,
        },
        makeSchedule(),
      );

      const row = db
        .prepare("SELECT retrieval_mode FROM recall_attempts WHERE card_id = ?")
        .get("card1") as any;
      expect(row.retrieval_mode).toBe("reversed");
    });

    it("increments gap_streak when correct + confidence='guess'", () => {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
          confidence: ConfidenceLevel.Guess,
        },
        makeSchedule(),
      );

      expect(statsRepo.getCardGapStreak("card1")).toBe(1);

      // Second guess should increment again
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now() + 1,
          responseTime: 2.0,
          quality: AnswerQuality.Perfect,
          wasTimed: false,
          confidence: ConfidenceLevel.Guess,
        },
        makeSchedule(),
      );

      expect(statsRepo.getCardGapStreak("card1")).toBe(2);
    });

    it("resets gap_streak when correct + confidence='knew'", () => {
      // First: build up a streak with guess
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
          confidence: ConfidenceLevel.Guess,
        },
        makeSchedule(),
      );
      expect(statsRepo.getCardGapStreak("card1")).toBe(1);

      // Now answer with 'knew' confidence - should reset
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now() + 1,
          responseTime: 1.5,
          quality: AnswerQuality.Perfect,
          wasTimed: false,
          confidence: ConfidenceLevel.Knew,
        },
        makeSchedule(),
      );
      expect(statsRepo.getCardGapStreak("card1")).toBe(0);
    });

    it("resets gap_streak on wrong answer", () => {
      // Build up a streak
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
          confidence: ConfidenceLevel.Guess,
        },
        makeSchedule(),
      );
      expect(statsRepo.getCardGapStreak("card1")).toBe(1);

      // Wrong answer resets
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now() + 1,
          responseTime: 5.0,
          quality: AnswerQuality.Wrong,
          wasTimed: false,
          confidence: ConfidenceLevel.Guess,
        },
        makeSchedule({ state: "relearning", lapses: 1 }),
      );
      expect(statsRepo.getCardGapStreak("card1")).toBe(0);
    });

    it("returns 0 for getCardEvolutionTier when not found", () => {
      expect(statsRepo.getCardEvolutionTier("nonexistent-card")).toBe(0);
    });

    it("updates evolution_tier when provided", () => {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule(),
        2,
      );
      expect(statsRepo.getCardEvolutionTier("card1")).toBe(2);
    });

    it("returns qualities in reverse chronological order", () => {
      const qualities = [
        AnswerQuality.Wrong,
        AnswerQuality.Partial,
        AnswerQuality.Correct,
        AnswerQuality.Perfect,
      ];
      for (let i = 0; i < qualities.length; i++) {
        statsRepo.recordAttempt(
          "card1",
          {
            cardId: "card1",
            timestamp: 1000 + i,
            responseTime: 2.0,
            quality: qualities[i],
            wasTimed: false,
          },
          makeSchedule({ state: qualities[i] === AnswerQuality.Wrong ? "relearning" : "learning" }),
        );
      }

      const recent = statsRepo.getRecentQualities("card1");
      expect(recent).toEqual(["perfect", "correct", "partial", "wrong"]);
    });

    it("returns modes in reverse chronological order", () => {
      const modes = [
        RetrievalMode.Standard,
        RetrievalMode.Reversed,
        RetrievalMode.Teach,
      ];
      for (let i = 0; i < modes.length; i++) {
        statsRepo.recordAttempt(
          "card1",
          {
            cardId: "card1",
            timestamp: 1000 + i,
            responseTime: 2.0,
            quality: AnswerQuality.Correct,
            wasTimed: false,
            retrievalMode: modes[i],
          },
          makeSchedule(),
        );
      }

      const recent = statsRepo.getRecentModes("card1");
      expect(recent).toEqual(["teach", "reversed", "standard"]);
    });

    it("returns per-day accuracy from getAccuracyHistory", () => {
      // Create attempts for a specific day (use a known timestamp)
      // Jan 1, 2026 00:00:00 UTC = 1767225600000
      const dayTs = 1767225600000;

      // 2 correct, 1 wrong = 2/3 accuracy
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: dayTs,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule(),
      );
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: dayTs + 1000,
          responseTime: 2.0,
          quality: AnswerQuality.Perfect,
          wasTimed: false,
        },
        makeSchedule(),
      );
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: dayTs + 2000,
          responseTime: 5.0,
          quality: AnswerQuality.Wrong,
          wasTimed: false,
        },
        makeSchedule({ state: "relearning", lapses: 1 }),
      );

      const accuracy = statsRepo.getAccuracyHistory(14);
      expect(accuracy).toHaveLength(1);
      expect(accuracy[0]).toBeCloseTo(2 / 3, 5);
    });

    it("getSchedule returns evolutionTier and gapStreak", () => {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
          confidence: ConfidenceLevel.Guess,
        },
        makeSchedule(),
        1,
      );

      const sched = statsRepo.getSchedule("card1");
      expect(sched).toBeDefined();
      expect(sched!.evolutionTier).toBe(1);
      expect(sched!.gapStreak).toBe(1);
    });

    it("getResponseTimeHistory returns avg response time per day", () => {
      const dayTs = 1767225600000;

      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: dayTs,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule(),
      );
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: dayTs + 1000,
          responseTime: 4.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule(),
      );

      const history = statsRepo.getResponseTimeHistory(14);
      expect(history).toHaveLength(1);
      expect(history[0]).toBeCloseTo(3.0, 5);
    });
  });

  describe("getNewCardsSeenToday", () => {
    beforeEach(() => {
      cardRepo.insertCards([
        { ...testCard, id: "card2" },
        { ...testCard, id: "card3" },
      ]);
    });

    it("returns 0 when no cards have been reviewed", () => {
      expect(statsRepo.getNewCardsSeenToday()).toBe(0);
    });

    it("counts cards first seen today", () => {
      // Review card1 for the first time today
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

      expect(statsRepo.getNewCardsSeenToday()).toBe(1);
    });

    it("does not count cards first seen before today", () => {
      // Review card1 yesterday
      const yesterday = Date.now() - 86400000 * 2;
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: yesterday,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card1", state: "learning" }),
      );

      expect(statsRepo.getNewCardsSeenToday()).toBe(0);
    });

    it("does not double-count cards reviewed multiple times today", () => {
      const now = Date.now();
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: now,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card1", state: "learning" }),
      );
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: now + 1000,
          responseTime: 1.5,
          quality: AnswerQuality.Perfect,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card1", state: "review" }),
      );

      expect(statsRepo.getNewCardsSeenToday()).toBe(1);
    });

    it("filters by deck ID", () => {
      cardRepo.createDeck({ id: "deck2", name: "Deck 2", description: "", createdAt: new Date().toISOString(), equipped: true });
      cardRepo.insertCard({ ...testCard, id: "d2c1", deckId: "deck2" });

      const now = Date.now();
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: now,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card1", state: "learning" }),
      );
      statsRepo.recordAttempt(
        "d2c1",
        {
          cardId: "d2c1",
          timestamp: now,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule({ cardId: "d2c1", state: "learning" }),
      );

      expect(statsRepo.getNewCardsSeenToday("deck1")).toBe(1);
      expect(statsRepo.getNewCardsSeenToday("deck2")).toBe(1);
      expect(statsRepo.getNewCardsSeenToday(["deck1", "deck2"])).toBe(2);
    });
  });

  describe("getDueCardsWithNewLimit", () => {
    beforeEach(() => {
      cardRepo.insertCards([
        { ...testCard, id: "card2" },
        { ...testCard, id: "card3" },
        { ...testCard, id: "card4" },
        { ...testCard, id: "card5" },
      ]);
    });

    it("limits new cards to maxNewCards when all are new", () => {
      // All 5 cards are new, limit to 2
      const { cardIds, newCardsRemaining } = statsRepo.getDueCardsWithNewLimit("deck1", 2);
      // Should have exactly 2 new cards (no review cards)
      expect(cardIds).toHaveLength(2);
      expect(newCardsRemaining).toBe(0);
    });

    it("allows all review cards through regardless of limit", () => {
      // Make card1 and card2 review cards with past-due dates
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
      statsRepo.recordAttempt(
        "card2",
        {
          cardId: "card2",
          timestamp: Date.now() - 172800000,
          responseTime: 2.0,
          quality: AnswerQuality.Perfect,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card2", state: "review", due: pastDue }),
      );

      // Set new card limit to 1
      const { cardIds } = statsRepo.getDueCardsWithNewLimit("deck1", 1);
      // Should have 2 review cards + 1 new card = 3
      expect(cardIds).toContain("card1");
      expect(cardIds).toContain("card2");
      expect(cardIds).toHaveLength(3); // 2 review + 1 new
    });

    it("subtracts cards already seen today from new card budget", () => {
      // Review card1 for the first time today
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now(),
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule({ cardId: "card1", state: "learning", due: new Date(Date.now() + 86400000).toISOString() }),
      );

      // Max 2 new per day, 1 already seen today = 1 remaining
      const { cardIds, newCardsRemaining } = statsRepo.getDueCardsWithNewLimit("deck1", 2);
      // card1 is now learning (not new, not due yet — future due date), so won't appear
      // card2, card3, card4, card5 are new but only 1 should be allowed
      const newCardCount = cardIds.filter(id => id !== "card1").length;
      expect(newCardCount).toBe(1);
      expect(newCardsRemaining).toBe(0);
    });

    it("returns 0 new cards remaining when limit is reached", () => {
      const { newCardsRemaining } = statsRepo.getDueCardsWithNewLimit("deck1", 0);
      expect(newCardsRemaining).toBe(0);
    });

    it("works with deck ID arrays", () => {
      cardRepo.createDeck({ id: "deck2", name: "Deck 2", description: "", createdAt: new Date().toISOString(), equipped: true });
      cardRepo.insertCards([
        { ...testCard, id: "d2c1", deckId: "deck2" },
        { ...testCard, id: "d2c2", deckId: "deck2" },
      ]);

      const { cardIds } = statsRepo.getDueCardsWithNewLimit(["deck1", "deck2"], 3);
      // Should have at most 3 new cards across both decks
      expect(cardIds).toHaveLength(3);
    });

    it("respects overall limit", () => {
      const { cardIds } = statsRepo.getDueCardsWithNewLimit("deck1", 20, 2);
      expect(cardIds).toHaveLength(2);
    });

    it("returns positive newCardsRemaining when budget exceeds new cards available", () => {
      // Only 5 new cards exist, budget is 10
      const { cardIds, newCardsRemaining } = statsRepo.getDueCardsWithNewLimit("deck1", 10);
      expect(cardIds).toHaveLength(5);
      expect(newCardsRemaining).toBe(5); // 10 - 5 = 5
    });
  });
});
