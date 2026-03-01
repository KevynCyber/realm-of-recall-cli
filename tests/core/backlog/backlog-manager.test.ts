import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../../src/data/database.js";
import { CardRepository } from "../../../src/data/repositories/CardRepository.js";
import { StatsRepository } from "../../../src/data/repositories/StatsRepository.js";
import {
  getBacklogInfo,
  getBacklogSessionCardIds,
  getWelcomeBackMessage,
  BACKLOG_THRESHOLD,
} from "../../../src/core/backlog/BacklogManager.js";
import {
  AnswerQuality,
  CardType,
  type Card,
  type Deck,
  type ScheduleData,
} from "../../../src/types/index.js";

// ─── Pure logic tests ───────────────────────────────────────────

describe("BacklogManager pure logic", () => {
  describe("getBacklogInfo", () => {
    it("returns shouldShowWelcomeBack=false when overdue count <= threshold", () => {
      const info = getBacklogInfo(50, Date.now() - 86400000 * 3);
      expect(info.shouldShowWelcomeBack).toBe(false);
      expect(info.overdueCount).toBe(50);
    });

    it("returns shouldShowWelcomeBack=true when overdue count > threshold", () => {
      const info = getBacklogInfo(51, Date.now() - 86400000 * 3);
      expect(info.shouldShowWelcomeBack).toBe(true);
      expect(info.overdueCount).toBe(51);
    });

    it("calculates days since last review correctly", () => {
      const threeDaysAgo = Date.now() - 86400000 * 3;
      const info = getBacklogInfo(60, threeDaysAgo);
      expect(info.daysSinceLastReview).toBe(3);
    });

    it("returns 0 days when lastReviewTimestamp is null", () => {
      const info = getBacklogInfo(60, null);
      expect(info.daysSinceLastReview).toBe(0);
    });

    it("returns 0 days when reviewed today", () => {
      const info = getBacklogInfo(60, Date.now() - 3600000); // 1 hour ago
      expect(info.daysSinceLastReview).toBe(0);
    });

    it("threshold constant is 50", () => {
      expect(BACKLOG_THRESHOLD).toBe(50);
    });

    it("handles large day counts correctly", () => {
      const sixtyDaysAgo = Date.now() - 86400000 * 60;
      const info = getBacklogInfo(200, sixtyDaysAgo);
      expect(info.daysSinceLastReview).toBe(60);
      expect(info.shouldShowWelcomeBack).toBe(true);
    });
  });

  describe("getBacklogSessionCardIds", () => {
    const ids = Array.from({ length: 100 }, (_, i) => `card-${i}`);

    it("quick returns first 10 cards", () => {
      const result = getBacklogSessionCardIds("quick", ids);
      expect(result).toHaveLength(10);
      expect(result[0]).toBe("card-0");
      expect(result[9]).toBe("card-9");
    });

    it("normal returns first 20 cards", () => {
      const result = getBacklogSessionCardIds("normal", ids);
      expect(result).toHaveLength(20);
      expect(result[0]).toBe("card-0");
      expect(result[19]).toBe("card-19");
    });

    it("full returns all cards", () => {
      const result = getBacklogSessionCardIds("full", ids);
      expect(result).toHaveLength(100);
    });

    it("quick returns all when fewer than 10 overdue", () => {
      const fewIds = ["a", "b", "c"];
      const result = getBacklogSessionCardIds("quick", fewIds);
      expect(result).toHaveLength(3);
    });

    it("normal returns all when fewer than 20 overdue", () => {
      const fewIds = Array.from({ length: 15 }, (_, i) => `card-${i}`);
      const result = getBacklogSessionCardIds("normal", fewIds);
      expect(result).toHaveLength(15);
    });

    it("preserves input order (stability-sorted)", () => {
      const sorted = ["high-stability", "mid-stability", "low-stability"];
      const result = getBacklogSessionCardIds("quick", sorted);
      expect(result).toEqual(sorted);
    });
  });

  describe("getWelcomeBackMessage", () => {
    it("returns a message for 0 days", () => {
      const msg = getWelcomeBackMessage(0, 60);
      expect(msg).toContain("60");
      expect(msg.length).toBeGreaterThan(0);
    });

    it("returns a message for 3 days", () => {
      const msg = getWelcomeBackMessage(3, 80);
      expect(msg).toContain("3 days");
      expect(msg).toContain("80");
    });

    it("returns a message for 14 days", () => {
      const msg = getWelcomeBackMessage(14, 150);
      expect(msg).toContain("14 days");
      expect(msg).toContain("150");
    });

    it("returns a message for 45 days", () => {
      const msg = getWelcomeBackMessage(45, 300);
      expect(msg).toContain("45 days");
      expect(msg).toContain("300");
    });

    it("different day ranges produce different messages", () => {
      const msg1 = getWelcomeBackMessage(1, 60);
      const msg3 = getWelcomeBackMessage(3, 60);
      const msg14 = getWelcomeBackMessage(14, 60);
      const msg45 = getWelcomeBackMessage(45, 60);
      // At least some messages should differ
      const unique = new Set([msg1, msg3, msg14, msg45]);
      expect(unique.size).toBeGreaterThanOrEqual(3);
    });
  });
});

// ─── Repository integration tests ──────────────────────────────

describe("StatsRepository overdue methods", () => {
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

  function makeCard(id: string): Card {
    return {
      id,
      front: `Q ${id}`,
      back: `A ${id}`,
      acceptableAnswers: [`A ${id}`],
      type: CardType.Basic,
      deckId: "deck1",
    };
  }

  function makeSchedule(cardId: string, overrides?: Partial<ScheduleData>): ScheduleData {
    return {
      cardId,
      difficulty: 5.0,
      stability: 1.0,
      reps: 1,
      lapses: 0,
      state: "review",
      due: new Date(Date.now() - 86400000).toISOString(), // past due by default
      lastReview: new Date(Date.now() - 172800000).toISOString(),
      ...overrides,
    };
  }

  beforeEach(() => {
    db = getInMemoryDatabase();
    cardRepo = new CardRepository(db);
    statsRepo = new StatsRepository(db);
    cardRepo.createDeck(testDeck);
  });

  describe("getOverdueCardIds", () => {
    it("returns empty array when no overdue cards", () => {
      cardRepo.insertCard(makeCard("card1"));
      // No stats recorded => card is 'new' state, not overdue
      expect(statsRepo.getOverdueCardIds()).toEqual([]);
    });

    it("returns overdue review cards", () => {
      cardRepo.insertCard(makeCard("card1"));
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
        makeSchedule("card1", { state: "review", due: pastDue }),
      );
      const ids = statsRepo.getOverdueCardIds();
      expect(ids).toContain("card1");
    });

    it("excludes new-state cards", () => {
      cardRepo.insertCard(makeCard("card1"));
      statsRepo.ensureStatsExist("card1");
      // card_state defaults to 'new', should not be overdue
      const ids = statsRepo.getOverdueCardIds();
      expect(ids).not.toContain("card1");
    });

    it("excludes suspended cards", () => {
      cardRepo.insertCard(makeCard("card1"));
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
        makeSchedule("card1", { state: "review", due: pastDue }),
      );
      statsRepo.suspendCard("card1");
      const ids = statsRepo.getOverdueCardIds();
      expect(ids).not.toContain("card1");
    });

    it("excludes buried cards", () => {
      cardRepo.insertCard(makeCard("card1"));
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
        makeSchedule("card1", { state: "review", due: pastDue }),
      );
      statsRepo.buryCard("card1");
      const ids = statsRepo.getOverdueCardIds();
      expect(ids).not.toContain("card1");
    });

    it("orders by stability DESC (highest first)", () => {
      cardRepo.insertCard(makeCard("low-stab"));
      cardRepo.insertCard(makeCard("mid-stab"));
      cardRepo.insertCard(makeCard("high-stab"));
      const pastDue = new Date(Date.now() - 86400000).toISOString();

      statsRepo.recordAttempt(
        "low-stab",
        {
          cardId: "low-stab",
          timestamp: Date.now() - 172800000,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule("low-stab", { state: "review", due: pastDue, stability: 1.0 }),
      );
      statsRepo.recordAttempt(
        "mid-stab",
        {
          cardId: "mid-stab",
          timestamp: Date.now() - 172800000,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule("mid-stab", { state: "review", due: pastDue, stability: 10.0 }),
      );
      statsRepo.recordAttempt(
        "high-stab",
        {
          cardId: "high-stab",
          timestamp: Date.now() - 172800000,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule("high-stab", { state: "review", due: pastDue, stability: 50.0 }),
      );

      const ids = statsRepo.getOverdueCardIds();
      expect(ids).toEqual(["high-stab", "mid-stab", "low-stab"]);
    });
  });

  describe("getLastReviewTimestamp", () => {
    it("returns null when no reviews exist", () => {
      expect(statsRepo.getLastReviewTimestamp()).toBe(null);
    });

    it("returns the most recent timestamp", () => {
      cardRepo.insertCard(makeCard("card1"));
      cardRepo.insertCard(makeCard("card2"));

      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: 1000,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule("card1"),
      );
      statsRepo.recordAttempt(
        "card2",
        {
          cardId: "card2",
          timestamp: 5000,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        makeSchedule("card2"),
      );

      expect(statsRepo.getLastReviewTimestamp()).toBe(5000);
    });
  });
});
