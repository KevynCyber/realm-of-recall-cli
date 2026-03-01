import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../../src/data/database.js";
import { CardRepository } from "../../../src/data/repositories/CardRepository.js";
import { StatsRepository } from "../../../src/data/repositories/StatsRepository.js";
import {
  AnswerQuality,
  CardType,
  type Card,
  type Deck,
  type ScheduleData,
} from "../../../src/types/index.js";
import {
  evaluateEvolutionTier,
  type EvolutionTier,
} from "../../../src/core/cards/CardEvolution.js";
import {
  createCombatState,
  resolveTurn,
} from "../../../src/core/combat/CombatEngine.js";
import { EnemyTier } from "../../../src/types/combat.js";
import type { Enemy } from "../../../src/types/combat.js";

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

const testCard: Card = {
  id: "card1",
  front: "Capital of France?",
  back: "Paris",
  acceptableAnswers: ["Paris"],
  type: CardType.Basic,
  deckId: "deck1",
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

beforeEach(() => {
  db = getInMemoryDatabase();
  cardRepo = new CardRepository(db);
  statsRepo = new StatsRepository(db);
  cardRepo.createDeck(testDeck);
  cardRepo.insertCard(testCard);
});

describe("evolution tier wiring into review flow", () => {
  it("recordAttempt persists evolutionTier when provided", () => {
    const schedule = makeSchedule();

    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now(),
        responseTime: 2.0,
        quality: AnswerQuality.Correct,
        wasTimed: false,
      },
      schedule,
      2,
    );

    const tier = statsRepo.getCardEvolutionTier("card1");
    expect(tier).toBe(2);
  });

  it("evolutionTier stays at 0 when not provided", () => {
    const schedule = makeSchedule();

    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now(),
        responseTime: 2.0,
        quality: AnswerQuality.Correct,
        wasTimed: false,
      },
      schedule,
    );

    const tier = statsRepo.getCardEvolutionTier("card1");
    expect(tier).toBe(0);
  });

  it("getCardEvolutionStats returns correct data for computing tier", () => {
    const schedule = makeSchedule({ stability: 15.0, lapses: 0, state: "review" });

    // Record 3 correct attempts to build up consecutive_correct
    for (let i = 0; i < 3; i++) {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now() + i,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        schedule,
      );
    }

    const evoStats = statsRepo.getCardEvolutionStats("card1");
    expect(evoStats.consecutiveCorrect).toBe(3);
    expect(evoStats.fsrsState).toBe("review");
    expect(evoStats.stability).toBe(15.0);
    expect(evoStats.lapses).toBe(0);
  });

  it("evaluateEvolutionTier computes correct tier from stats data", () => {
    const schedule = makeSchedule({ stability: 15.0, lapses: 0, state: "review" });

    // Record 3 correct attempts
    for (let i = 0; i < 3; i++) {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now() + i,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        schedule,
      );
    }

    const evoStats = statsRepo.getCardEvolutionStats("card1");

    // With 3 consecutive correct, state=review, stability=15 => tier 2
    const tier = evaluateEvolutionTier(
      evoStats.consecutiveCorrect,
      evoStats.currentTier as EvolutionTier,
      evoStats.fsrsState,
      evoStats.stability,
      evoStats.lapses,
    );
    expect(tier).toBe(2);
  });

  it("full flow: records attempt then computes and persists evolution tier", () => {
    // Simulate the pattern used in App.tsx handleReviewComplete
    const schedule = makeSchedule({ stability: 15.0, lapses: 0, state: "review" });

    // Build up 2 correct answers first (without tier computation)
    for (let i = 0; i < 2; i++) {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now() + i,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        schedule,
      );
    }

    // Now do the third answer with tier computation (like handleReviewComplete does)
    const evoStats = statsRepo.getCardEvolutionStats("card1");
    expect(evoStats.consecutiveCorrect).toBe(2);

    const isCorrect = true;
    const newConsecutive = isCorrect ? evoStats.consecutiveCorrect + 1 : 0;
    const tier = evaluateEvolutionTier(
      newConsecutive,
      evoStats.currentTier as EvolutionTier,
      schedule.state,
      schedule.stability,
      evoStats.lapses,
    );

    // 3 consecutive correct + stability 15 + state review => tier 2
    expect(tier).toBe(2);

    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now() + 3,
        responseTime: 2.0,
        quality: AnswerQuality.Correct,
        wasTimed: false,
      },
      schedule,
      tier,
    );

    // Verify the tier was persisted
    expect(statsRepo.getCardEvolutionTier("card1")).toBe(2);
  });

  it("wrong answer resets consecutive_correct and prevents tier promotion", () => {
    const schedule = makeSchedule({ stability: 15.0, lapses: 0, state: "review" });

    // 2 correct then 1 wrong
    for (let i = 0; i < 2; i++) {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now() + i,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        schedule,
      );
    }
    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now() + 2,
        responseTime: 2.0,
        quality: AnswerQuality.Wrong,
        wasTimed: false,
      },
      schedule,
    );

    const evoStats = statsRepo.getCardEvolutionStats("card1");
    expect(evoStats.consecutiveCorrect).toBe(0);

    const tier = evaluateEvolutionTier(
      0, // wrong answer resets
      evoStats.currentTier as EvolutionTier,
      schedule.state,
      schedule.stability,
      evoStats.lapses,
    );
    expect(tier).toBe(0);
  });
});

describe("evolution tier affects combat damage", () => {
  const playerAttack = 10;
  const playerDefense = 3;
  const noCritRng = () => 1;

  it("tier 0 card deals base damage (no multiplier)", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state,
      AnswerQuality.Correct,
      playerAttack,
      playerDefense,
      0,
      noCritRng,
      undefined,
      0,
    );

    // Correct default: floor(10 * 1.0 * 1.0) = 10
    expect(event.damage).toBe(10);
  });

  it("tier 1 card deals 1.25x damage", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state,
      AnswerQuality.Correct,
      playerAttack,
      playerDefense,
      0,
      noCritRng,
      undefined,
      1,
    );

    // floor(10 * 1.0 * 1.25) = 12
    expect(event.damage).toBe(12);
  });

  it("tier 2 card deals 1.5x damage", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state,
      AnswerQuality.Correct,
      playerAttack,
      playerDefense,
      0,
      noCritRng,
      undefined,
      2,
    );

    // floor(10 * 1.0 * 1.5) = 15
    expect(event.damage).toBe(15);
  });

  it("tier 3 card deals 2.0x damage", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state,
      AnswerQuality.Correct,
      playerAttack,
      playerDefense,
      0,
      noCritRng,
      undefined,
      3,
    );

    // floor(10 * 1.0 * 2.0) = 20
    expect(event.damage).toBe(20);
  });

  it("tier 3 with Perfect answer deals massive damage", () => {
    const state = createCombatState(makeEnemy({ hp: 200 }), 100, 100, 5);
    const { event } = resolveTurn(
      state,
      AnswerQuality.Perfect,
      playerAttack,
      playerDefense,
      0,
      noCritRng,
      undefined,
      3,
    );

    // Perfect default baseMult=2.0, tier3=2.0x => floor(10 * 2.0 * 2.0) = 40
    expect(event.damage).toBe(40);
  });
});
