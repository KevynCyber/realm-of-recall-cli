import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../src/data/database.js";
import { CardRepository } from "../../src/data/repositories/CardRepository.js";
import { ZoneRepository } from "../../src/data/repositories/ZoneRepository.js";
import type { Zone, Deck } from "../../src/types/index.js";

let db: Database.Database;
let zoneRepo: ZoneRepository;
let cardRepo: CardRepository;

const testDeck1: Deck = {
  id: "deck1",
  name: "Math",
  description: "Math deck",
  createdAt: new Date().toISOString(),
};

const testDeck2: Deck = {
  id: "deck2",
  name: "Science",
  description: "Science deck",
  createdAt: new Date().toISOString(),
};

const zone1: Zone = {
  id: "zone1",
  name: "Forest of Numbers",
  deckId: "deck1",
  requiredMastery: 0.7,
  bossDefeated: false,
  orderIndex: 0,
};

const zone2: Zone = {
  id: "zone2",
  name: "Lab of Elements",
  deckId: "deck2",
  requiredMastery: 0.8,
  bossDefeated: false,
  orderIndex: 1,
};

beforeEach(() => {
  db = getInMemoryDatabase();
  zoneRepo = new ZoneRepository(db);
  cardRepo = new CardRepository(db);
  cardRepo.createDeck(testDeck1);
  cardRepo.createDeck(testDeck2);
});

describe("ZoneRepository", () => {
  it("creates and retrieves zones ordered by order_index", () => {
    zoneRepo.createZone(zone2);
    zoneRepo.createZone(zone1);
    const zones = zoneRepo.getZones();
    expect(zones).toHaveLength(2);
    expect(zones[0].name).toBe("Forest of Numbers");
    expect(zones[1].name).toBe("Lab of Elements");
  });

  it("returns empty array when no zones exist", () => {
    const zones = zoneRepo.getZones();
    expect(zones).toHaveLength(0);
  });

  it("gets zone by deck ID", () => {
    zoneRepo.createZone(zone1);
    zoneRepo.createZone(zone2);
    const zone = zoneRepo.getZoneByDeckId("deck2");
    expect(zone).not.toBeNull();
    expect(zone!.name).toBe("Lab of Elements");
    expect(zone!.requiredMastery).toBe(0.8);
  });

  it("returns null when deck has no zone", () => {
    const zone = zoneRepo.getZoneByDeckId("nonexistent");
    expect(zone).toBeNull();
  });

  it("marks boss as defeated", () => {
    zoneRepo.createZone(zone1);
    expect(zoneRepo.getZones()[0].bossDefeated).toBe(false);

    zoneRepo.markBossDefeated("zone1");
    const updated = zoneRepo.getZones()[0];
    expect(updated.bossDefeated).toBe(true);
  });

  it("maps snake_case to camelCase correctly", () => {
    zoneRepo.createZone(zone1);
    const zone = zoneRepo.getZoneByDeckId("deck1");
    expect(zone!.deckId).toBe("deck1");
    expect(zone!.requiredMastery).toBe(0.7);
    expect(zone!.bossDefeated).toBe(false);
    expect(zone!.orderIndex).toBe(0);
  });
});
