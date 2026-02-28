import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../src/data/database.js";
import { CardRepository } from "../../src/data/repositories/CardRepository.js";
import { ReflectionRepository } from "../../src/data/repositories/ReflectionRepository.js";
import type { Deck } from "../../src/types/index.js";

let db: Database.Database;
let cardRepo: CardRepository;
let reflectionRepo: ReflectionRepository;

const testDeck: Deck = {
  id: "deck1",
  name: "Test Deck",
  description: "For testing",
  createdAt: new Date().toISOString(),
  equipped: true,
};

beforeEach(() => {
  db = getInMemoryDatabase();
  cardRepo = new CardRepository(db);
  reflectionRepo = new ReflectionRepository(db);
  cardRepo.createDeck(testDeck);
});

describe("ReflectionRepository", () => {
  describe("saveReflection and getRecentReflections", () => {
    it("saves a reflection and retrieves it", () => {
      reflectionRepo.saveReflection({
        id: "ref1",
        sessionType: "combat",
        difficultyRating: 2,
        journalEntry: "That was challenging",
        promptUsed: "What did you learn?",
        accuracy: 0.85,
        cardsReviewed: 10,
        deckId: "deck1",
      });

      const reflections = reflectionRepo.getRecentReflections();
      expect(reflections).toHaveLength(1);
      expect(reflections[0].id).toBe("ref1");
      expect(reflections[0].sessionType).toBe("combat");
      expect(reflections[0].difficultyRating).toBe(2);
      expect(reflections[0].journalEntry).toBe("That was challenging");
      expect(reflections[0].promptUsed).toBe("What did you learn?");
      expect(reflections[0].accuracy).toBe(0.85);
      expect(reflections[0].cardsReviewed).toBe(10);
      expect(reflections[0].deckId).toBe("deck1");
      expect(reflections[0].createdAt).toBeDefined();
    });

    it("saves a reflection without journal entry", () => {
      reflectionRepo.saveReflection({
        id: "ref-no-journal",
        sessionType: "review",
        difficultyRating: 1,
        accuracy: 0.95,
        cardsReviewed: 5,
      });

      const reflections = reflectionRepo.getRecentReflections();
      expect(reflections).toHaveLength(1);
      expect(reflections[0].id).toBe("ref-no-journal");
      expect(reflections[0].sessionType).toBe("review");
      expect(reflections[0].journalEntry).toBeNull();
      expect(reflections[0].promptUsed).toBeNull();
      expect(reflections[0].deckId).toBeNull();
    });

    it("saves a reflection with journal entry but no prompt", () => {
      reflectionRepo.saveReflection({
        id: "ref-journal-only",
        sessionType: "combat",
        difficultyRating: 3,
        journalEntry: "I need to review more",
        accuracy: 0.6,
        cardsReviewed: 8,
        deckId: "deck1",
      });

      const reflections = reflectionRepo.getRecentReflections();
      expect(reflections).toHaveLength(1);
      expect(reflections[0].journalEntry).toBe("I need to review more");
      expect(reflections[0].promptUsed).toBeNull();
    });
  });

  describe("getRecentReflections ordering", () => {
    it("returns most recent reflections first", () => {
      // Insert with explicit created_at to control ordering
      db.prepare(
        `INSERT INTO session_reflections (id, session_type, created_at, difficulty_rating, accuracy, cards_reviewed)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("ref-old", "review", "2025-01-01T00:00:00.000Z", 1, 0.7, 5);

      db.prepare(
        `INSERT INTO session_reflections (id, session_type, created_at, difficulty_rating, accuracy, cards_reviewed)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("ref-mid", "combat", "2025-06-15T00:00:00.000Z", 2, 0.8, 10);

      db.prepare(
        `INSERT INTO session_reflections (id, session_type, created_at, difficulty_rating, accuracy, cards_reviewed)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("ref-new", "review", "2026-01-01T00:00:00.000Z", 3, 0.95, 15);

      const reflections = reflectionRepo.getRecentReflections();
      expect(reflections).toHaveLength(3);
      expect(reflections[0].id).toBe("ref-new");
      expect(reflections[1].id).toBe("ref-mid");
      expect(reflections[2].id).toBe("ref-old");
    });
  });

  describe("getReflectionCount", () => {
    it("returns 0 when no reflections exist", () => {
      expect(reflectionRepo.getReflectionCount()).toBe(0);
    });

    it("returns correct count after adding reflections", () => {
      reflectionRepo.saveReflection({
        id: "ref1",
        sessionType: "combat",
        difficultyRating: 1,
        accuracy: 0.9,
        cardsReviewed: 10,
      });

      reflectionRepo.saveReflection({
        id: "ref2",
        sessionType: "review",
        difficultyRating: 2,
        accuracy: 0.8,
        cardsReviewed: 5,
      });

      reflectionRepo.saveReflection({
        id: "ref3",
        sessionType: "combat",
        difficultyRating: 3,
        accuracy: 0.7,
        cardsReviewed: 8,
      });

      expect(reflectionRepo.getReflectionCount()).toBe(3);
    });
  });

  describe("getRecentAccuracies", () => {
    it("returns accuracy values in most-recent-first order", () => {
      db.prepare(
        `INSERT INTO session_reflections (id, session_type, created_at, difficulty_rating, accuracy, cards_reviewed)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("ref1", "review", "2025-01-01T00:00:00.000Z", 1, 0.6, 5);

      db.prepare(
        `INSERT INTO session_reflections (id, session_type, created_at, difficulty_rating, accuracy, cards_reviewed)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("ref2", "combat", "2025-06-15T00:00:00.000Z", 2, 0.75, 10);

      db.prepare(
        `INSERT INTO session_reflections (id, session_type, created_at, difficulty_rating, accuracy, cards_reviewed)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("ref3", "review", "2026-01-01T00:00:00.000Z", 3, 0.95, 15);

      const accuracies = reflectionRepo.getRecentAccuracies();
      expect(accuracies).toEqual([0.95, 0.75, 0.6]);
    });

    it("returns empty array when no reflections exist", () => {
      expect(reflectionRepo.getRecentAccuracies()).toEqual([]);
    });

    it("respects custom limit", () => {
      for (let i = 0; i < 5; i++) {
        reflectionRepo.saveReflection({
          id: `ref-${i}`,
          sessionType: "review",
          difficultyRating: 1,
          accuracy: 0.5 + i * 0.1,
          cardsReviewed: 5,
        });
      }

      const accuracies = reflectionRepo.getRecentAccuracies(3);
      expect(accuracies).toHaveLength(3);
    });
  });

  describe("default limits", () => {
    it("getRecentReflections defaults to limit 20", () => {
      for (let i = 0; i < 25; i++) {
        reflectionRepo.saveReflection({
          id: `ref-${i}`,
          sessionType: "review",
          difficultyRating: 1,
          accuracy: 0.8,
          cardsReviewed: 5,
        });
      }

      const reflections = reflectionRepo.getRecentReflections();
      expect(reflections).toHaveLength(20);
    });

    it("getRecentAccuracies defaults to limit 10", () => {
      for (let i = 0; i < 15; i++) {
        reflectionRepo.saveReflection({
          id: `ref-${i}`,
          sessionType: "combat",
          difficultyRating: 2,
          accuracy: 0.7,
          cardsReviewed: 10,
        });
      }

      const accuracies = reflectionRepo.getRecentAccuracies();
      expect(accuracies).toHaveLength(10);
    });
  });
});
