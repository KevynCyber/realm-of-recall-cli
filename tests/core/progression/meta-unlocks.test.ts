import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../../src/data/database.js";
import { UnlockRepository } from "../../../src/data/repositories/UnlockRepository.js";
import {
  getAllUnlocks,
  getRequiredAscension,
  getUnlocksForAscension,
} from "../../../src/core/progression/MetaUnlocks.js";

describe("MetaUnlocks", () => {
  describe("getAllUnlocks", () => {
    it("returns 8 unlock definitions", () => {
      const unlocks = getAllUnlocks();
      expect(unlocks).toHaveLength(8);
    });

    it("each unlock has key, name, description, and requiredAscension", () => {
      const unlocks = getAllUnlocks();
      for (const u of unlocks) {
        expect(u.key).toBeTruthy();
        expect(u.name).toBeTruthy();
        expect(u.description).toBeTruthy();
        expect(u.requiredAscension).toBeGreaterThanOrEqual(1);
        expect(u.requiredAscension).toBeLessThanOrEqual(10);
      }
    });

    it("all unlock keys are unique", () => {
      const unlocks = getAllUnlocks();
      const keys = unlocks.map((u) => u.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("returns a copy (not the original array)", () => {
      const a = getAllUnlocks();
      const b = getAllUnlocks();
      expect(a).not.toBe(b);
    });
  });

  describe("getRequiredAscension", () => {
    it("returns correct ascension for reversed_mode", () => {
      expect(getRequiredAscension("reversed_mode")).toBe(1);
    });

    it("returns correct ascension for teach_mode", () => {
      expect(getRequiredAscension("teach_mode")).toBe(2);
    });

    it("returns correct ascension for connect_mode", () => {
      expect(getRequiredAscension("connect_mode")).toBe(3);
    });

    it("returns correct ascension for prismatic_variants", () => {
      expect(getRequiredAscension("prismatic_variants")).toBe(4);
    });

    it("returns correct ascension for extended_dungeon", () => {
      expect(getRequiredAscension("extended_dungeon")).toBe(5);
    });

    it("returns correct ascension for nightmare_enemies", () => {
      expect(getRequiredAscension("nightmare_enemies")).toBe(7);
    });

    it("returns correct ascension for master_title", () => {
      expect(getRequiredAscension("master_title")).toBe(10);
    });

    it("returns undefined for unknown key", () => {
      expect(getRequiredAscension("nonexistent")).toBeUndefined();
    });
  });

  describe("getUnlocksForAscension", () => {
    it("returns no unlocks at ascension 0", () => {
      expect(getUnlocksForAscension(0)).toHaveLength(0);
    });

    it("returns 1 unlock at ascension 1", () => {
      const unlocks = getUnlocksForAscension(1);
      expect(unlocks).toHaveLength(1);
      expect(unlocks[0].key).toBe("reversed_mode");
    });

    it("returns 4 unlocks at ascension 3", () => {
      const unlocks = getUnlocksForAscension(3);
      expect(unlocks).toHaveLength(4);
      const keys = unlocks.map((u) => u.key);
      expect(keys).toContain("reversed_mode");
      expect(keys).toContain("teach_mode");
      expect(keys).toContain("connect_mode");
      expect(keys).toContain("generate_mode");
    });

    it("returns 6 unlocks at ascension 5", () => {
      const unlocks = getUnlocksForAscension(5);
      expect(unlocks).toHaveLength(6);
    });

    it("returns 7 unlocks at ascension 7 (skips 6)", () => {
      const unlocks = getUnlocksForAscension(7);
      expect(unlocks).toHaveLength(7);
      const keys = unlocks.map((u) => u.key);
      expect(keys).toContain("nightmare_enemies");
    });

    it("returns all 8 unlocks at ascension 10", () => {
      const unlocks = getUnlocksForAscension(10);
      expect(unlocks).toHaveLength(8);
    });
  });
});

describe("UnlockRepository", () => {
  let db: Database.Database;
  let unlockRepo: UnlockRepository;

  beforeEach(() => {
    db = getInMemoryDatabase();
    unlockRepo = new UnlockRepository(db);
  });

  describe("unlock", () => {
    it("unlocks a key", () => {
      unlockRepo.unlock("reversed_mode");
      expect(unlockRepo.isUnlocked("reversed_mode")).toBe(true);
    });

    it("is idempotent — unlocking same key twice does not throw", () => {
      unlockRepo.unlock("reversed_mode");
      unlockRepo.unlock("reversed_mode");
      expect(unlockRepo.isUnlocked("reversed_mode")).toBe(true);
    });
  });

  describe("isUnlocked", () => {
    it("returns false for a key that was never unlocked", () => {
      expect(unlockRepo.isUnlocked("master_title")).toBe(false);
    });

    it("returns true for an unlocked key", () => {
      unlockRepo.unlock("teach_mode");
      expect(unlockRepo.isUnlocked("teach_mode")).toBe(true);
    });
  });

  describe("getUnlockedKeys", () => {
    it("returns empty set when nothing is unlocked", () => {
      const keys = unlockRepo.getUnlockedKeys();
      expect(keys.size).toBe(0);
    });

    it("returns all unlocked keys", () => {
      unlockRepo.unlock("reversed_mode");
      unlockRepo.unlock("teach_mode");
      unlockRepo.unlock("connect_mode");

      const keys = unlockRepo.getUnlockedKeys();
      expect(keys.size).toBe(3);
      expect(keys.has("reversed_mode")).toBe(true);
      expect(keys.has("teach_mode")).toBe(true);
      expect(keys.has("connect_mode")).toBe(true);
    });

    it("does not include keys that were not unlocked", () => {
      unlockRepo.unlock("reversed_mode");

      const keys = unlockRepo.getUnlockedKeys();
      expect(keys.has("master_title")).toBe(false);
    });
  });

  describe("integration: awarding unlocks on ascension", () => {
    it("awards correct unlocks when ascending from 0 to 3", () => {
      const earned = getUnlocksForAscension(3);
      for (const unlock of earned) {
        unlockRepo.unlock(unlock.key);
      }

      const keys = unlockRepo.getUnlockedKeys();
      expect(keys.size).toBe(4);
      expect(keys.has("reversed_mode")).toBe(true);
      expect(keys.has("teach_mode")).toBe(true);
      expect(keys.has("connect_mode")).toBe(true);
      expect(keys.has("generate_mode")).toBe(true);
      expect(keys.has("prismatic_variants")).toBe(false);
    });

    it("persists unlocks across repository instances", () => {
      unlockRepo.unlock("extended_dungeon");

      const newRepo = new UnlockRepository(db);
      expect(newRepo.isUnlocked("extended_dungeon")).toBe(true);
    });
  });
});
