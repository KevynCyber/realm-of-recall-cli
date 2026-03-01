import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../src/data/database.js";
import { EnemyRepository } from "../../src/data/repositories/EnemyRepository.js";
import { EnemyTier } from "../../src/types/combat.js";

let db: Database.Database;
let enemyRepo: EnemyRepository;

beforeEach(() => {
  db = getInMemoryDatabase();
  enemyRepo = new EnemyRepository(db);
});

describe("EnemyRepository", () => {
  describe("trackEncounter", () => {
    it("inserts a new encounter record on first defeat", () => {
      enemyRepo.trackEncounter("Goblin", EnemyTier.Common);

      const encounters = enemyRepo.getEncounters();
      expect(encounters).toHaveLength(1);
      expect(encounters[0].enemyName).toBe("Goblin");
      expect(encounters[0].enemyTier).toBe(1);
      expect(encounters[0].timesDefeated).toBe(1);
      expect(encounters[0].firstDefeatedAt).toBeTruthy();
      expect(encounters[0].lastDefeatedAt).toBeTruthy();
    });

    it("increments times_defeated on subsequent encounters", () => {
      enemyRepo.trackEncounter("Slime", EnemyTier.Minion);
      enemyRepo.trackEncounter("Slime", EnemyTier.Minion);
      enemyRepo.trackEncounter("Slime", EnemyTier.Minion);

      const encounters = enemyRepo.getEncounters();
      expect(encounters).toHaveLength(1);
      expect(encounters[0].timesDefeated).toBe(3);
    });

    it("preserves first_defeated_at on upsert", () => {
      enemyRepo.trackEncounter("Dragon", EnemyTier.Boss);
      const first = enemyRepo.getEncounters()[0].firstDefeatedAt;

      enemyRepo.trackEncounter("Dragon", EnemyTier.Boss);
      const after = enemyRepo.getEncounters()[0].firstDefeatedAt;

      expect(after).toBe(first);
    });

    it("updates last_defeated_at on upsert", () => {
      enemyRepo.trackEncounter("Knight", EnemyTier.Elite);
      const firstLast = enemyRepo.getEncounters()[0].lastDefeatedAt;

      // SQLite datetime('now') within same second may be equal, but the update still runs
      enemyRepo.trackEncounter("Knight", EnemyTier.Elite);
      const secondLast = enemyRepo.getEncounters()[0].lastDefeatedAt;

      // last_defeated_at should be updated (or at minimum equal if within same second)
      expect(secondLast).toBeTruthy();
      expect(secondLast! >= firstLast!).toBe(true);
    });

    it("treats same name with different tiers as separate encounters", () => {
      enemyRepo.trackEncounter("Goblin", EnemyTier.Common);
      enemyRepo.trackEncounter("Goblin", EnemyTier.Elite);

      const encounters = enemyRepo.getEncounters();
      expect(encounters).toHaveLength(2);
      expect(encounters[0].enemyTier).toBe(1); // Common
      expect(encounters[1].enemyTier).toBe(2); // Elite
    });
  });

  describe("getEncounters", () => {
    it("returns empty array when no encounters exist", () => {
      expect(enemyRepo.getEncounters()).toEqual([]);
    });

    it("returns encounters sorted by tier then name", () => {
      enemyRepo.trackEncounter("Wolf", EnemyTier.Common);
      enemyRepo.trackEncounter("Bat", EnemyTier.Minion);
      enemyRepo.trackEncounter("Dragon", EnemyTier.Boss);
      enemyRepo.trackEncounter("Knight", EnemyTier.Elite);
      enemyRepo.trackEncounter("Slime", EnemyTier.Minion);
      enemyRepo.trackEncounter("Goblin", EnemyTier.Common);

      const encounters = enemyRepo.getEncounters();
      expect(encounters).toHaveLength(6);

      // Minions first (tier 0), sorted by name
      expect(encounters[0].enemyName).toBe("Bat");
      expect(encounters[0].enemyTier).toBe(0);
      expect(encounters[1].enemyName).toBe("Slime");
      expect(encounters[1].enemyTier).toBe(0);

      // Common (tier 1)
      expect(encounters[2].enemyName).toBe("Goblin");
      expect(encounters[2].enemyTier).toBe(1);
      expect(encounters[3].enemyName).toBe("Wolf");
      expect(encounters[3].enemyTier).toBe(1);

      // Elite (tier 2)
      expect(encounters[4].enemyName).toBe("Knight");
      expect(encounters[4].enemyTier).toBe(2);

      // Boss (tier 3)
      expect(encounters[5].enemyName).toBe("Dragon");
      expect(encounters[5].enemyTier).toBe(3);
    });
  });

  describe("getEncounterCount", () => {
    it("returns 0 when no encounters exist", () => {
      expect(enemyRepo.getEncounterCount()).toBe(0);
    });

    it("returns count of unique enemies defeated", () => {
      enemyRepo.trackEncounter("Slime", EnemyTier.Minion);
      enemyRepo.trackEncounter("Goblin", EnemyTier.Common);
      enemyRepo.trackEncounter("Dragon", EnemyTier.Boss);

      expect(enemyRepo.getEncounterCount()).toBe(3);
    });

    it("does not double-count repeated defeats of same enemy", () => {
      enemyRepo.trackEncounter("Slime", EnemyTier.Minion);
      enemyRepo.trackEncounter("Slime", EnemyTier.Minion);
      enemyRepo.trackEncounter("Slime", EnemyTier.Minion);

      expect(enemyRepo.getEncounterCount()).toBe(1);
    });

    it("counts same name different tier as separate entries", () => {
      enemyRepo.trackEncounter("Goblin", EnemyTier.Common);
      enemyRepo.trackEncounter("Goblin", EnemyTier.Elite);

      expect(enemyRepo.getEncounterCount()).toBe(2);
    });
  });
});
