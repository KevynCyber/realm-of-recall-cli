import { describe, it, expect, beforeEach } from "vitest";
import {
  applyAscensionToCombat,
  getDefaultCombatSettings,
} from "../../src/core/progression/AscensionSystem.js";
import { evaluateAnswer } from "../../src/core/cards/CardEvaluator.js";
import { AnswerQuality } from "../../src/types/index.js";
import type { Card } from "../../src/types/index.js";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../src/data/database.js";
import { PlayerRepository } from "../../src/data/repositories/PlayerRepository.js";
import { PlayerClass } from "../../src/types/index.js";
import type { Player } from "../../src/types/index.js";
import { createNewPlayer } from "../../src/core/player/PlayerStats.js";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    deckId: "deck-1",
    front: "What is 2+2?",
    back: "4",
    acceptableAnswers: ["4", "four"],
    tags: [],
    ...overrides,
  };
}

describe("Configurable answer timer", () => {
  describe("Player type and persistence", () => {
    let db: Database.Database;
    let playerRepo: PlayerRepository;

    beforeEach(() => {
      db = getInMemoryDatabase();
      playerRepo = new PlayerRepository(db);
    });

    it("createNewPlayer defaults timerSeconds to 30", () => {
      const player = createNewPlayer("TestHero", PlayerClass.Scholar);
      expect(player.timerSeconds).toBe(30);
    });

    it("persists timerSeconds with default value", () => {
      const player = createNewPlayer("TestHero", PlayerClass.Scholar);
      playerRepo.createPlayer(player);
      const loaded = playerRepo.getPlayer();
      expect(loaded!.timerSeconds).toBe(30);
    });

    it("persists custom timerSeconds value", () => {
      const player = createNewPlayer("TestHero", PlayerClass.Scholar);
      player.timerSeconds = 45;
      playerRepo.createPlayer(player);
      const loaded = playerRepo.getPlayer();
      expect(loaded!.timerSeconds).toBe(45);
    });

    it("persists timerSeconds = 0 (disabled)", () => {
      const player = createNewPlayer("TestHero", PlayerClass.Scholar);
      player.timerSeconds = 0;
      playerRepo.createPlayer(player);
      const loaded = playerRepo.getPlayer();
      expect(loaded!.timerSeconds).toBe(0);
    });

    it("updates timerSeconds", () => {
      const player = createNewPlayer("TestHero", PlayerClass.Scholar);
      playerRepo.createPlayer(player);
      playerRepo.updatePlayer({ ...player, timerSeconds: 60 });
      const loaded = playerRepo.getPlayer();
      expect(loaded!.timerSeconds).toBe(60);
    });
  });

  describe("Timer disabled (timerSeconds = 0)", () => {
    it("evaluateAnswer never returns Timeout when totalTime is Infinity", () => {
      const card = makeCard();
      // Even at 9999 seconds, should not timeout
      const quality = evaluateAnswer(card, "4", 9999, Infinity);
      expect(quality).toBe(AnswerQuality.Correct);
    });

    it("evaluateAnswer still returns Timeout for empty answer even with Infinity timer", () => {
      const card = makeCard();
      const quality = evaluateAnswer(card, "", 5, Infinity);
      expect(quality).toBe(AnswerQuality.Timeout);
    });
  });

  describe("Configurable timer values", () => {
    it("15s timer times out at 15 seconds", () => {
      const card = makeCard();
      const quality = evaluateAnswer(card, "4", 16, 15);
      expect(quality).toBe(AnswerQuality.Timeout);
    });

    it("15s timer accepts answer within time", () => {
      const card = makeCard();
      const quality = evaluateAnswer(card, "4", 10, 15);
      expect(quality).toBe(AnswerQuality.Correct);
    });

    it("60s timer allows answers up to 60 seconds", () => {
      const card = makeCard();
      const quality = evaluateAnswer(card, "4", 55, 60);
      expect(quality).toBe(AnswerQuality.Correct);
    });

    it("60s timer times out at 60 seconds", () => {
      const card = makeCard();
      const quality = evaluateAnswer(card, "4", 60, 60);
      expect(quality).toBe(AnswerQuality.Timeout);
    });
  });

  describe("Timer interaction with ascension modifiers", () => {
    it("ascension reduces configured timer, not hardcoded 30", () => {
      // Player set timer to 45s
      const baseSettings = { ...getDefaultCombatSettings(), timerSeconds: 45 };
      const settings = applyAscensionToCombat(baseSettings, 2);
      // 45 - 5 = 40, not 30 - 5 = 25
      expect(settings.timerSeconds).toBe(40);
    });

    it("ascension reduces 20s configured timer to 15s", () => {
      const baseSettings = { ...getDefaultCombatSettings(), timerSeconds: 20 };
      const settings = applyAscensionToCombat(baseSettings, 2);
      expect(settings.timerSeconds).toBe(15);
    });

    it("ascension does not reduce timer below 10s", () => {
      const baseSettings = { ...getDefaultCombatSettings(), timerSeconds: 12 };
      const settings = applyAscensionToCombat(baseSettings, 2);
      expect(settings.timerSeconds).toBe(10);
    });

    it("ascension does not reduce disabled timer (0)", () => {
      const baseSettings = { ...getDefaultCombatSettings(), timerSeconds: 0 };
      const settings = applyAscensionToCombat(baseSettings, 2);
      expect(settings.timerSeconds).toBe(0);
    });

    it("ascension level 10 does not affect disabled timer", () => {
      const baseSettings = { ...getDefaultCombatSettings(), timerSeconds: 0 };
      const settings = applyAscensionToCombat(baseSettings, 10);
      expect(settings.timerSeconds).toBe(0);
    });

    it("reduced timer correctly causes Timeout in evaluateAnswer", () => {
      const card = makeCard();
      // Player sets 45s, ascension 2 reduces to 40s
      const baseSettings = { ...getDefaultCombatSettings(), timerSeconds: 45 };
      const settings = applyAscensionToCombat(baseSettings, 2);
      // 41 seconds: would pass at 45s but fail at 40s
      const quality = evaluateAnswer(card, "4", 41, settings.timerSeconds);
      expect(quality).toBe(AnswerQuality.Timeout);
    });

    it("answer within reduced timer is not timed out", () => {
      const card = makeCard();
      const baseSettings = { ...getDefaultCombatSettings(), timerSeconds: 45 };
      const settings = applyAscensionToCombat(baseSettings, 2);
      const quality = evaluateAnswer(card, "4", 35, settings.timerSeconds);
      expect(quality).toBe(AnswerQuality.Correct);
    });
  });
});
