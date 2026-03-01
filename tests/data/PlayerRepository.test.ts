import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../src/data/database.js";
import { PlayerRepository } from "../../src/data/repositories/PlayerRepository.js";
import { PlayerClass } from "../../src/types/index.js";
import type { Player } from "../../src/types/index.js";

let db: Database.Database;
let playerRepo: PlayerRepository;

const testPlayer: Player = {
  id: 1,
  name: "TestHero",
  class: PlayerClass.Scholar,
  level: 1,
  xp: 0,
  hp: 100,
  maxHp: 100,
  attack: 10,
  defense: 5,
  gold: 50,
  streakDays: 0,
  longestStreak: 0,
  lastReviewDate: null,
  shieldCount: 0,
  totalReviews: 0,
  totalCorrect: 0,
  combatWins: 0,
  combatLosses: 0,
  wisdomXp: 0,
  ascensionLevel: 0,
  skillPoints: 0,
  dailyChallengeSeed: null,
  dailyChallengeCompleted: false,
  dailyChallengeScore: 0,
  dailyChallengeDate: null,
  desiredRetention: 0.9,
  maxNewCardsPerDay: 20,
  timerSeconds: 30,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  db = getInMemoryDatabase();
  playerRepo = new PlayerRepository(db);
});

describe("PlayerRepository", () => {
  it("returns null when no player exists", () => {
    const player = playerRepo.getPlayer();
    expect(player).toBeNull();
  });

  it("creates and retrieves a player", () => {
    playerRepo.createPlayer(testPlayer);
    const player = playerRepo.getPlayer();
    expect(player).not.toBeNull();
    expect(player!.name).toBe("TestHero");
    expect(player!.class).toBe(PlayerClass.Scholar);
    expect(player!.level).toBe(1);
    expect(player!.gold).toBe(50);
    expect(player!.maxHp).toBe(100);
    expect(player!.lastReviewDate).toBeNull();
  });

  it("updates a player", () => {
    playerRepo.createPlayer(testPlayer);
    const updated: Player = {
      ...testPlayer,
      name: "UpdatedHero",
      level: 5,
      xp: 250,
      gold: 100,
    };
    playerRepo.updatePlayer(updated);
    const player = playerRepo.getPlayer();
    expect(player!.name).toBe("UpdatedHero");
    expect(player!.level).toBe(5);
    expect(player!.xp).toBe(250);
    expect(player!.gold).toBe(100);
  });

  it("adds gold to the player", () => {
    playerRepo.createPlayer(testPlayer);
    playerRepo.addGold(30);
    const player = playerRepo.getPlayer();
    expect(player!.gold).toBe(80);
  });

  it("removes gold from the player", () => {
    playerRepo.createPlayer(testPlayer);
    playerRepo.removeGold(20);
    const player = playerRepo.getPlayer();
    expect(player!.gold).toBe(30);
  });

  it("clamps gold at 0 when removing more than available", () => {
    playerRepo.createPlayer(testPlayer);
    playerRepo.removeGold(999);
    const player = playerRepo.getPlayer();
    expect(player!.gold).toBe(0);
  });

  it("persists desiredRetention with default value", () => {
    playerRepo.createPlayer(testPlayer);
    const player = playerRepo.getPlayer();
    expect(player!.desiredRetention).toBe(0.9);
  });

  it("persists custom desiredRetention value", () => {
    playerRepo.createPlayer({ ...testPlayer, desiredRetention: 0.85 });
    const player = playerRepo.getPlayer();
    expect(player!.desiredRetention).toBe(0.85);
  });

  it("updates desiredRetention", () => {
    playerRepo.createPlayer(testPlayer);
    playerRepo.updatePlayer({ ...testPlayer, desiredRetention: 0.95 });
    const player = playerRepo.getPlayer();
    expect(player!.desiredRetention).toBe(0.95);
  });

  it("persists maxNewCardsPerDay with default value", () => {
    playerRepo.createPlayer(testPlayer);
    const player = playerRepo.getPlayer();
    expect(player!.maxNewCardsPerDay).toBe(20);
  });

  it("persists custom maxNewCardsPerDay value", () => {
    playerRepo.createPlayer({ ...testPlayer, maxNewCardsPerDay: 10 });
    const player = playerRepo.getPlayer();
    expect(player!.maxNewCardsPerDay).toBe(10);
  });

  it("updates maxNewCardsPerDay", () => {
    playerRepo.createPlayer(testPlayer);
    playerRepo.updatePlayer({ ...testPlayer, maxNewCardsPerDay: 50 });
    const player = playerRepo.getPlayer();
    expect(player!.maxNewCardsPerDay).toBe(50);
  });

  it("persists timerSeconds with default value", () => {
    playerRepo.createPlayer(testPlayer);
    const player = playerRepo.getPlayer();
    expect(player!.timerSeconds).toBe(30);
  });

  it("persists custom timerSeconds value", () => {
    playerRepo.createPlayer({ ...testPlayer, timerSeconds: 45 });
    const player = playerRepo.getPlayer();
    expect(player!.timerSeconds).toBe(45);
  });

  it("updates timerSeconds", () => {
    playerRepo.createPlayer(testPlayer);
    playerRepo.updatePlayer({ ...testPlayer, timerSeconds: 0 });
    const player = playerRepo.getPlayer();
    expect(player!.timerSeconds).toBe(0);
  });
});
