import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { tryAwardVariant, type CardVariant } from "../../../src/core/cards/CardVariants.js";
import { getInMemoryDatabase } from "../../../src/data/database.js";
import { CardRepository } from "../../../src/data/repositories/CardRepository.js";
import { StatsRepository } from "../../../src/data/repositories/StatsRepository.js";
import { AnswerQuality, CardType, type Card, type Deck, type ScheduleData } from "../../../src/types/index.js";

// ─── Pure logic tests (tryAwardVariant) ───

describe("tryAwardVariant", () => {
  it("returns null when consecutiveCorrect < 5", () => {
    expect(tryAwardVariant(0, null, () => 0)).toBeNull();
    expect(tryAwardVariant(1, null, () => 0)).toBeNull();
    expect(tryAwardVariant(4, null, () => 0)).toBeNull();
  });

  it("returns null when card already has a variant (no-overwrite rule)", () => {
    // Even with lowest possible roll and high streak, no overwrite
    expect(tryAwardVariant(10, "foil", () => 0)).toBeNull();
    expect(tryAwardVariant(10, "golden", () => 0)).toBeNull();
    expect(tryAwardVariant(10, "prismatic", () => 0)).toBeNull();
  });

  it("awards prismatic when roll < 0.001", () => {
    expect(tryAwardVariant(5, null, () => 0)).toBe("prismatic");
    expect(tryAwardVariant(5, null, () => 0.0009)).toBe("prismatic");
  });

  it("awards golden when roll is in [0.001, 0.01)", () => {
    expect(tryAwardVariant(5, null, () => 0.001)).toBe("golden");
    expect(tryAwardVariant(5, null, () => 0.0099)).toBe("golden");
  });

  it("awards foil when roll is in [0.01, 0.05)", () => {
    expect(tryAwardVariant(5, null, () => 0.01)).toBe("foil");
    expect(tryAwardVariant(5, null, () => 0.049)).toBe("foil");
  });

  it("returns null when roll >= 0.05 (no drop)", () => {
    expect(tryAwardVariant(5, null, () => 0.05)).toBeNull();
    expect(tryAwardVariant(5, null, () => 0.5)).toBeNull();
    expect(tryAwardVariant(5, null, () => 0.999)).toBeNull();
  });

  it("works at exactly 5 consecutive correct", () => {
    // foil roll should succeed at exactly 5
    expect(tryAwardVariant(5, null, () => 0.02)).toBe("foil");
  });

  it("works at high consecutive correct counts", () => {
    expect(tryAwardVariant(100, null, () => 0.0005)).toBe("prismatic");
  });

  it("uses Math.random by default (returns variant or null)", () => {
    // Just verify it doesn't throw with default rng
    const result = tryAwardVariant(5, null);
    expect(result === null || result === "foil" || result === "golden" || result === "prismatic").toBe(true);
  });
});

// ─── Repository tests (awardVariant, getCardVariant, getVariantCounts) ───

describe("StatsRepository variant methods", () => {
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

  function makeSchedule(cardId: string): ScheduleData {
    return {
      cardId,
      difficulty: 5.0,
      stability: 1.0,
      reps: 1,
      lapses: 0,
      state: "learning",
      due: new Date(Date.now() + 86400000).toISOString(),
      lastReview: new Date().toISOString(),
    };
  }

  beforeEach(() => {
    db = getInMemoryDatabase();
    cardRepo = new CardRepository(db);
    statsRepo = new StatsRepository(db);
    cardRepo.createDeck(testDeck);
    cardRepo.insertCard(makeCard("card1"));
    cardRepo.insertCard(makeCard("card2"));
    cardRepo.insertCard(makeCard("card3"));
  });

  it("awardVariant sets variant on a card with no existing variant", () => {
    statsRepo.ensureStatsExist("card1");
    statsRepo.awardVariant("card1", "foil");
    expect(statsRepo.getCardVariant("card1")).toBe("foil");
  });

  it("awardVariant does not overwrite an existing variant", () => {
    statsRepo.ensureStatsExist("card1");
    statsRepo.awardVariant("card1", "foil");
    statsRepo.awardVariant("card1", "prismatic");
    expect(statsRepo.getCardVariant("card1")).toBe("foil");
  });

  it("getCardVariant returns null for cards with no variant", () => {
    statsRepo.ensureStatsExist("card1");
    expect(statsRepo.getCardVariant("card1")).toBeNull();
  });

  it("getCardVariant returns null for non-existent cards", () => {
    expect(statsRepo.getCardVariant("nonexistent")).toBeNull();
  });

  it("getVariantCounts returns zeros when no variants awarded", () => {
    expect(statsRepo.getVariantCounts()).toEqual({
      foil: 0,
      golden: 0,
      prismatic: 0,
    });
  });

  it("getVariantCounts returns correct counts per variant type", () => {
    statsRepo.ensureStatsExist("card1");
    statsRepo.ensureStatsExist("card2");
    statsRepo.ensureStatsExist("card3");

    statsRepo.awardVariant("card1", "foil");
    statsRepo.awardVariant("card2", "foil");
    statsRepo.awardVariant("card3", "golden");

    expect(statsRepo.getVariantCounts()).toEqual({
      foil: 2,
      golden: 1,
      prismatic: 0,
    });
  });

  it("variant column defaults to NULL in new recall_stats rows", () => {
    // Record an attempt which creates a stats row
    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now(),
        responseTime: 1.5,
        quality: AnswerQuality.Perfect,
        wasTimed: false,
      },
      makeSchedule("card1"),
    );
    expect(statsRepo.getCardVariant("card1")).toBeNull();
  });
});
