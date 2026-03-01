import { describe, it, expect } from "vitest";
import {
  applyAscensionToCombat,
  getDefaultCombatSettings,
} from "../../../src/core/progression/AscensionSystem.js";
import type { CombatSettings } from "../../../src/core/progression/AscensionSystem.js";
import {
  createCombatState,
  resolveTurn,
} from "../../../src/core/combat/CombatEngine.js";
import { evaluateAnswer } from "../../../src/core/cards/CardEvaluator.js";
import { AnswerQuality, EnemyTier } from "../../../src/types/index.js";
import type { Enemy } from "../../../src/types/combat.js";
import type { Card } from "../../../src/types/index.js";

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    name: "Goblin",
    tier: EnemyTier.Common,
    hp: 100,
    maxHp: 100,
    attack: 10,
    xpReward: 50,
    goldReward: 20,
    ...overrides,
  };
}

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

describe("Ascension combat settings wiring", () => {
  describe("timerSeconds", () => {
    it("default settings use 30 seconds", () => {
      const settings = getDefaultCombatSettings();
      expect(settings.timerSeconds).toBe(30);
    });

    it("ascension level 2 reduces timer to 25 seconds", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 2);
      expect(settings.timerSeconds).toBe(25);
    });

    it("timerSeconds is used as totalTime for evaluateAnswer", () => {
      const card = makeCard();
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 2);
      // Response at 26 seconds: with default 30s timer this is valid, with 25s timer it's Timeout
      const quality = evaluateAnswer(card, "4", 26, settings.timerSeconds);
      expect(quality).toBe(AnswerQuality.Timeout);
    });

    it("answer within reduced timer is not timed out", () => {
      const card = makeCard();
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 2);
      // Response at 20 seconds: within the 25s limit
      const quality = evaluateAnswer(card, "4", 20, settings.timerSeconds);
      expect(quality).toBe(AnswerQuality.Correct);
    });
  });

  describe("partialCreditEnabled", () => {
    it("default settings enable partial credit", () => {
      const settings = getDefaultCombatSettings();
      expect(settings.partialCreditEnabled).toBe(true);
    });

    it("ascension level 3 disables partial credit", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 3);
      expect(settings.partialCreditEnabled).toBe(false);
    });

    it("partial answer is treated as Wrong when partial credit disabled", () => {
      const card = makeCard({ acceptableAnswers: ["mitochondria"] });
      // "mito" is a substring of "mitochondria" — normally Partial
      const baseQuality = evaluateAnswer(card, "mito", 5, 30);
      expect(baseQuality).toBe(AnswerQuality.Partial);

      // With partialCreditEnabled=false, the CombatScreen logic converts Partial to Wrong
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 3);
      let quality = evaluateAnswer(card, "mito", 5, settings.timerSeconds);
      if (quality === AnswerQuality.Partial && !settings.partialCreditEnabled) {
        quality = AnswerQuality.Wrong;
      }
      expect(quality).toBe(AnswerQuality.Wrong);
    });

    it("correct answer is unaffected when partial credit disabled", () => {
      const card = makeCard({ acceptableAnswers: ["mitochondria"] });
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 3);
      let quality = evaluateAnswer(card, "mitochondria", 5, settings.timerSeconds);
      if (quality === AnswerQuality.Partial && !settings.partialCreditEnabled) {
        quality = AnswerQuality.Wrong;
      }
      expect(quality).toBe(AnswerQuality.Correct);
    });
  });

  describe("startingHpPercent", () => {
    it("default settings start at 100% HP", () => {
      const settings = getDefaultCombatSettings();
      expect(settings.startingHpPercent).toBe(100);
    });

    it("ascension level 5 starts at 80% HP", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 5);
      expect(settings.startingHpPercent).toBe(80);
    });

    it("starting HP is correctly reduced for combat state", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 5);
      const playerHp = 100;
      const startingHp = Math.max(1, Math.floor(playerHp * (settings.startingHpPercent / 100)));
      const state = createCombatState(makeEnemy(), 100, startingHp, 5);
      expect(state.playerHp).toBe(80);
    });

    it("starting HP is at least 1 even with low HP", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 5);
      const playerHp = 1;
      const startingHp = Math.max(1, Math.floor(playerHp * (settings.startingHpPercent / 100)));
      expect(startingHp).toBe(1); // floor(1 * 0.8) = 0, but clamped to 1
    });
  });

  describe("enemyPoisonDamage", () => {
    it("default settings have 0 poison damage", () => {
      const settings = getDefaultCombatSettings();
      expect(settings.enemyPoisonDamage).toBe(0);
    });

    it("ascension level 8 sets poison damage to 2", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 8);
      expect(settings.enemyPoisonDamage).toBe(2);
    });

    it("poison damage is applied at start of each turn via CombatEngine", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 8);
      const state = createCombatState(makeEnemy(), 100, 100, 5);
      // Set poison damage as CombatScreen would
      state.poisonDamage = settings.enemyPoisonDamage;

      // Resolve a turn — poison is applied at start of turn
      const { newState } = resolveTurn(
        state,
        AnswerQuality.Correct,
        10,
        3,
        0,
        () => 1,
      );

      // Player takes 2 poison at start, then deals damage to enemy (no damage to player)
      expect(newState.playerHp).toBe(98); // 100 - 2 poison
      // Poison is consumed (set to 0) by CombatEngine after applying
      expect(newState.poisonDamage).toBe(0);
    });

    it("poison damage is re-applied after each turn for persistent ascension poison", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 8);
      let state = createCombatState(makeEnemy(), 100, 100, 5);
      state.poisonDamage = settings.enemyPoisonDamage;

      // Turn 1: poison applies (2 damage), answer correct
      const { newState: after1 } = resolveTurn(
        state,
        AnswerQuality.Correct,
        10,
        3,
        0,
        () => 1,
      );
      // Re-apply ascension poison (as CombatScreen does)
      after1.poisonDamage = settings.enemyPoisonDamage;
      expect(after1.playerHp).toBe(98); // 100 - 2

      // Turn 2: poison applies again
      const { newState: after2 } = resolveTurn(
        after1,
        AnswerQuality.Correct,
        10,
        3,
        0,
        () => 1,
      );
      expect(after2.playerHp).toBe(96); // 98 - 2
    });
  });

  describe("hintsEnabled", () => {
    it("default settings have hints enabled", () => {
      const settings = getDefaultCombatSettings();
      expect(settings.hintsEnabled).toBe(true);
    });

    it("ascension level 7 disables hints", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 7);
      expect(settings.hintsEnabled).toBe(false);
    });
  });

  describe("lootDropMultiplier", () => {
    it("default settings have 1.0 loot multiplier", () => {
      const settings = getDefaultCombatSettings();
      expect(settings.lootDropMultiplier).toBe(1.0);
    });

    it("ascension level 6 halves loot drop rate", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 6);
      expect(settings.lootDropMultiplier).toBe(0.5);
    });
  });

  describe("consecutiveCorrectRequired", () => {
    it("default settings require 1 consecutive correct", () => {
      const settings = getDefaultCombatSettings();
      expect(settings.consecutiveCorrectRequired).toBe(1);
    });

    it("ascension level 9 requires 2 consecutive correct", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 9);
      expect(settings.consecutiveCorrectRequired).toBe(2);
    });
  });

  describe("cumulative ascension modifiers at level 10", () => {
    it("all combat settings are modified at ascension 10", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 10);
      expect(settings.timerSeconds).toBe(25);
      expect(settings.partialCreditEnabled).toBe(false);
      expect(settings.startingHpPercent).toBe(80);
      expect(settings.lootDropMultiplier).toBe(0.5);
      expect(settings.hintsEnabled).toBe(false);
      expect(settings.enemyPoisonDamage).toBe(2);
      expect(settings.consecutiveCorrectRequired).toBe(2);
    });

    it("combined modifiers affect combat state correctly", () => {
      const settings = applyAscensionToCombat(getDefaultCombatSettings(), 10);
      const playerHp = 100;
      const startingHp = Math.max(1, Math.floor(playerHp * (settings.startingHpPercent / 100)));
      const state = createCombatState(makeEnemy(), 100, startingHp, 5);
      state.poisonDamage = settings.enemyPoisonDamage;

      // Starting HP is 80% of 100 = 80
      expect(state.playerHp).toBe(80);
      // Poison is set
      expect(state.poisonDamage).toBe(2);

      // Resolve turn: poison applies first (80 - 2 = 78), then correct answer
      const { newState } = resolveTurn(
        state,
        AnswerQuality.Correct,
        10,
        3,
        0,
        () => 1,
      );
      expect(newState.playerHp).toBe(78);
    });
  });
});
