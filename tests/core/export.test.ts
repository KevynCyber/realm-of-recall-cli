import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../src/data/database.js";
import { CardRepository } from "../../src/data/repositories/CardRepository.js";
import { StatsRepository } from "../../src/data/repositories/StatsRepository.js";
import { PlayerRepository } from "../../src/data/repositories/PlayerRepository.js";
import { buildExportData } from "../../src/core/export.js";
import type { ExportData } from "../../src/core/export.js";
import {
  AnswerQuality,
  CardType,
  PlayerClass,
  type Card,
  type Deck,
  type Player,
  type ScheduleData,
} from "../../src/types/index.js";

let db: Database.Database;
let cardRepo: CardRepository;
let statsRepo: StatsRepository;
let playerRepo: PlayerRepository;

const testDeck: Deck = {
  id: "deck1",
  name: "Geography",
  description: "World capitals",
  createdAt: new Date().toISOString(),
  equipped: true,
};

const testCards: Card[] = [
  {
    id: "card1",
    front: "Capital of France?",
    back: "Paris",
    acceptableAnswers: ["Paris", "paris"],
    type: CardType.Basic,
    deckId: "deck1",
  },
  {
    id: "card2",
    front: "Capital of Japan?",
    back: "Tokyo",
    acceptableAnswers: ["Tokyo"],
    type: CardType.Basic,
    deckId: "deck1",
  },
];

const testPlayer: Player = {
  id: 1,
  name: "TestHero",
  class: PlayerClass.Scholar,
  level: 5,
  xp: 1200,
  hp: 90,
  maxHp: 100,
  attack: 15,
  defense: 10,
  gold: 250,
  streakDays: 3,
  longestStreak: 7,
  lastReviewDate: "2026-02-28",
  shieldCount: 1,
  totalReviews: 50,
  totalCorrect: 40,
  combatWins: 10,
  combatLosses: 2,
  wisdomXp: 100,
  ascensionLevel: 0,
  skillPoints: 0,
  skillRecall: 0,
  skillBattle: 0,
  skillScholar: 0,
  dailyChallengeSeed: null,
  dailyChallengeCompleted: false,
  dailyChallengeScore: 0,
  dailyChallengeDate: null,
  desiredRetention: 0.9,
  maxNewCardsPerDay: 20,
  timerSeconds: 30,
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
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
  playerRepo = new PlayerRepository(db);
});

describe("buildExportData", () => {
  it("exports empty data when database has no decks or player", () => {
    const { data, cardCount } = buildExportData(db);

    expect(data.version).toBe(1);
    expect(data.exportedAt).toBeDefined();
    expect(data.decks).toEqual([]);
    expect(data.reviewStats).toEqual([]);
    expect(data.player).toBeNull();
    expect(cardCount).toBe(0);
  });

  it("exports decks and cards", () => {
    cardRepo.createDeck(testDeck);
    cardRepo.insertCards(testCards);

    const { data, cardCount } = buildExportData(db);

    expect(data.decks).toHaveLength(1);
    expect(data.decks[0].name).toBe("Geography");
    expect(data.decks[0].description).toBe("World capitals");
    expect(data.decks[0].cards).toHaveLength(2);
    expect(data.decks[0].cards[0].front).toBe("Capital of France?");
    expect(data.decks[0].cards[0].back).toBe("Paris");
    expect(data.decks[0].cards[0].acceptableAnswers).toEqual(["Paris", "paris"]);
    expect(data.decks[0].cards[0].type).toBe("basic");
    expect(cardCount).toBe(2);
  });

  it("exports multiple decks", () => {
    cardRepo.createDeck(testDeck);
    cardRepo.insertCards(testCards);

    const deck2: Deck = {
      id: "deck2",
      name: "Math",
      description: "Arithmetic",
      createdAt: new Date().toISOString(),
      equipped: true,
    };
    cardRepo.createDeck(deck2);
    cardRepo.insertCard({
      id: "card3",
      front: "2+2?",
      back: "4",
      acceptableAnswers: ["4", "four"],
      type: CardType.Basic,
      deckId: "deck2",
    });

    const { data, cardCount } = buildExportData(db);

    expect(data.decks).toHaveLength(2);
    expect(cardCount).toBe(3);
  });

  it("exports review statistics for reviewed cards", () => {
    cardRepo.createDeck(testDeck);
    cardRepo.insertCards(testCards);

    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now(),
        responseTime: 2.0,
        quality: AnswerQuality.Correct,
        wasTimed: false,
      },
      makeSchedule({ cardId: "card1", state: "learning", difficulty: 5.5, stability: 2.0 }),
    );

    const { data } = buildExportData(db);

    expect(data.reviewStats).toHaveLength(1);
    expect(data.reviewStats[0].cardFront).toBe("Capital of France?");
    expect(data.reviewStats[0].deckName).toBe("Geography");
    expect(data.reviewStats[0].totalAttempts).toBe(1);
    expect(data.reviewStats[0].correctCount).toBe(1);
    expect(data.reviewStats[0].difficulty).toBe(5.5);
    expect(data.reviewStats[0].stability).toBe(2.0);
    expect(data.reviewStats[0].cardState).toBe("learning");
  });

  it("exports player profile without equipment/inventory fields", () => {
    playerRepo.createPlayer(testPlayer);

    const { data } = buildExportData(db);

    expect(data.player).not.toBeNull();
    expect(data.player!.name).toBe("TestHero");
    expect(data.player!.class).toBe("scholar");
    expect(data.player!.level).toBe(5);
    expect(data.player!.xp).toBe(1200);
    expect(data.player!.hp).toBe(90);
    expect(data.player!.maxHp).toBe(100);
    expect(data.player!.attack).toBe(15);
    expect(data.player!.defense).toBe(10);
    expect(data.player!.gold).toBe(250);
    expect(data.player!.streakDays).toBe(3);
    expect(data.player!.longestStreak).toBe(7);
    expect(data.player!.totalReviews).toBe(50);
    expect(data.player!.totalCorrect).toBe(40);
    expect(data.player!.combatWins).toBe(10);
    expect(data.player!.combatLosses).toBe(2);

    // Must not include equipment/inventory fields
    const playerKeys = Object.keys(data.player!);
    expect(playerKeys).not.toContain("equipment");
    expect(playerKeys).not.toContain("inventory");
    expect(playerKeys).not.toContain("shieldCount");
    expect(playerKeys).not.toContain("wisdomXp");
    expect(playerKeys).not.toContain("ascensionLevel");
    expect(playerKeys).not.toContain("dailyChallengeSeed");
  });

  it("produces import-compatible deck/card format", () => {
    cardRepo.createDeck(testDeck);
    cardRepo.insertCards(testCards);

    const { data } = buildExportData(db);

    // Each deck in the export should match what JsonImporter expects:
    // { name: string, description?: string, cards: Array<{ front, back, acceptableAnswers?, type? }> }
    for (const deck of data.decks) {
      expect(deck).toHaveProperty("name");
      expect(deck).toHaveProperty("cards");
      expect(Array.isArray(deck.cards)).toBe(true);
      for (const card of deck.cards) {
        expect(card).toHaveProperty("front");
        expect(card).toHaveProperty("back");
        expect(card).toHaveProperty("acceptableAnswers");
        expect(card).toHaveProperty("type");
      }
    }
  });

  it("exported JSON is valid and parseable", () => {
    cardRepo.createDeck(testDeck);
    cardRepo.insertCards(testCards);
    playerRepo.createPlayer(testPlayer);

    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now(),
        responseTime: 2.0,
        quality: AnswerQuality.Correct,
        wasTimed: false,
      },
      makeSchedule({ cardId: "card1" }),
    );

    const { data } = buildExportData(db);
    const json = JSON.stringify(data);
    const parsed: ExportData = JSON.parse(json);

    expect(parsed.version).toBe(1);
    expect(parsed.decks).toHaveLength(1);
    expect(parsed.reviewStats).toHaveLength(1);
    expect(parsed.player).not.toBeNull();
  });

  it("each exported deck can be individually imported via importJson format", () => {
    cardRepo.createDeck(testDeck);
    cardRepo.insertCards(testCards);

    const { data } = buildExportData(db);

    // Simulate what JsonImporter would receive: write deck to string and parse
    for (const deck of data.decks) {
      const deckJson = JSON.stringify(deck);
      const parsed = JSON.parse(deckJson);

      // Verify it has the fields JsonImporter reads
      expect(typeof parsed.name).toBe("string");
      expect(Array.isArray(parsed.cards)).toBe(true);
      expect(parsed.cards.length).toBeGreaterThan(0);
      expect(typeof parsed.cards[0].front).toBe("string");
      expect(typeof parsed.cards[0].back).toBe("string");
    }
  });

  it("includes exportedAt as valid ISO date", () => {
    const { data } = buildExportData(db);
    const date = new Date(data.exportedAt);
    expect(date.toISOString()).toBe(data.exportedAt);
  });
});
