import { describe, it, expect } from "vitest";
import {
  createCombatState,
  resolveTurn,
  isCombatOver,
  getCombatRewards,
} from "../../src/core/combat/CombatEngine.js";
import { AnswerQuality, ConfidenceLevel, RetrievalMode } from "../../src/types/index.js";
import { EnemyTier } from "../../src/types/combat.js";
import type { Enemy } from "../../src/types/combat.js";

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

describe("createCombatState", () => {
  it("initializes correctly with given values", () => {
    const enemy = makeEnemy();
    const state = createCombatState(enemy, 100, 80, 5);

    expect(state.enemy).toEqual(enemy);
    expect(state.playerHp).toBe(80);
    expect(state.playerMaxHp).toBe(100);
    expect(state.events).toEqual([]);
    expect(state.currentCardIndex).toBe(0);
    expect(state.totalCards).toBe(5);
    expect(state.poisonDamage).toBe(0);
    expect(state.stats).toEqual({
      perfectCount: 0,
      correctCount: 0,
      partialCount: 0,
      wrongCount: 0,
    });
  });
});

describe("resolveTurn", () => {
  const playerAttack = 10;
  const playerDefense = 3;
  const critChance = 0;
  const noCritRng = () => 1; // never crits

  it("Perfect answer deals 2x damage to enemy", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { newState, event } = resolveTurn(
      state,
      AnswerQuality.Perfect,
      playerAttack,
      playerDefense,
      critChance,
      noCritRng,
    );

    expect(event.action).toBe("player_attack");
    expect(event.damage).toBe(20); // 10 * 2
    expect(newState.enemy.hp).toBe(80); // 100 - 20
    expect(newState.playerHp).toBe(100); // unchanged
    expect(newState.stats.perfectCount).toBe(1);
    expect(newState.currentCardIndex).toBe(1);
  });

  it("Perfect with crit (rng=()=>0, critChance=100) deals 2.5x damage", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { newState, event } = resolveTurn(
      state,
      AnswerQuality.Perfect,
      playerAttack,
      playerDefense,
      100, // critChance = 100%
      () => 0, // rng returns 0, which is < 100/100 = 1
    );

    expect(event.action).toBe("player_critical");
    expect(event.damage).toBe(25); // floor(10 * 2.5)
    expect(newState.enemy.hp).toBe(75); // 100 - 25
    expect(newState.stats.perfectCount).toBe(1);
  });

  it("Correct answer deals 1x damage to enemy", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { newState, event } = resolveTurn(
      state,
      AnswerQuality.Correct,
      playerAttack,
      playerDefense,
      critChance,
      noCritRng,
    );

    expect(event.action).toBe("player_attack");
    expect(event.damage).toBe(10); // 10 * 1
    expect(newState.enemy.hp).toBe(90); // 100 - 10
    expect(newState.playerHp).toBe(100);
    expect(newState.stats.correctCount).toBe(1);
  });

  it("Partial answer deals 0.5x damage to enemy", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { newState, event } = resolveTurn(
      state,
      AnswerQuality.Partial,
      playerAttack,
      playerDefense,
      critChance,
      noCritRng,
    );

    expect(event.action).toBe("player_glancing");
    expect(event.damage).toBe(5); // floor(10 * 0.5)
    expect(newState.enemy.hp).toBe(95); // 100 - 5
    expect(newState.playerHp).toBe(100);
    expect(newState.stats.partialCount).toBe(1);
  });

  it("Wrong answer deals enemy damage to player (minus defense, min 1)", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { newState, event } = resolveTurn(
      state,
      AnswerQuality.Wrong,
      playerAttack,
      playerDefense,
      critChance,
      noCritRng,
    );

    // enemyAttack=10, playerDefense=3 → damage = max(1, 10-3) = 7
    expect(event.action).toBe("enemy_attack");
    expect(event.damage).toBe(7);
    expect(newState.playerHp).toBe(93); // 100 - 7
    expect(newState.enemy.hp).toBe(100); // unchanged
    expect(newState.stats.wrongCount).toBe(1);
  });

  it("Wrong answer respects minimum damage of 1", () => {
    const enemy = makeEnemy({ attack: 2 }); // attack < defense
    const state = createCombatState(enemy, 100, 100, 5);
    const { event } = resolveTurn(
      state,
      AnswerQuality.Wrong,
      playerAttack,
      playerDefense,
      critChance,
      noCritRng,
    );

    // max(1, 2-3) = max(1, -1) = 1
    expect(event.damage).toBe(1);
  });

  it("Timeout deals damage AND sets poison", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { newState, event } = resolveTurn(
      state,
      AnswerQuality.Timeout,
      playerAttack,
      playerDefense,
      critChance,
      noCritRng,
    );

    // damage = max(1, 10-3) = 7
    expect(event.action).toBe("enemy_poison");
    expect(event.damage).toBe(7);
    expect(newState.playerHp).toBe(93); // 100 - 7
    expect(newState.poisonDamage).toBe(5);
    expect(newState.stats.wrongCount).toBe(1);
  });

  it("poison applies at start of next turn", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);

    // First turn: timeout sets poison
    const { newState: afterTimeout } = resolveTurn(
      state,
      AnswerQuality.Timeout,
      playerAttack,
      playerDefense,
      critChance,
      noCritRng,
    );
    expect(afterTimeout.poisonDamage).toBe(5);

    // Second turn: poison applies before the turn resolves
    const { newState: afterPoison } = resolveTurn(
      afterTimeout,
      AnswerQuality.Correct,
      playerAttack,
      playerDefense,
      critChance,
      noCritRng,
    );

    // After timeout: playerHp = 100 - 7 = 93
    // Poison at start of next turn: 93 - 5 = 88
    // Correct answer deals damage to enemy, not player
    expect(afterPoison.playerHp).toBe(88);
    expect(afterPoison.poisonDamage).toBe(0);
    // Should have a poison event in the events list
    const poisonEvents = afterPoison.events.filter(
      (e) => e.description.includes("Poison deals"),
    );
    expect(poisonEvents.length).toBe(1);
  });

  it("does not mutate the original state", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    resolveTurn(state, AnswerQuality.Correct, playerAttack, playerDefense, critChance, noCritRng);

    expect(state.enemy.hp).toBe(100);
    expect(state.currentCardIndex).toBe(0);
    expect(state.stats.correctCount).toBe(0);
    expect(state.events.length).toBe(0);
  });
});

describe("isCombatOver", () => {
  it("returns victory=true when enemy HP is 0", () => {
    const state = createCombatState(makeEnemy({ hp: 0 }), 100, 50, 5);
    const result = isCombatOver(state);
    expect(result.over).toBe(true);
    expect(result.victory).toBe(true);
  });

  it("returns victory=false when player HP is 0", () => {
    const state = createCombatState(makeEnemy(), 100, 0, 5);
    const result = isCombatOver(state);
    expect(result.over).toBe(true);
    expect(result.victory).toBe(false);
  });

  it("returns over=false when both are alive", () => {
    const state = createCombatState(makeEnemy(), 100, 50, 5);
    const result = isCombatOver(state);
    expect(result.over).toBe(false);
    expect(result.victory).toBe(false);
  });
});

describe("getCombatRewards", () => {
  it("calculates xp and gold correctly", () => {
    const enemy = makeEnemy({ xpReward: 100, goldReward: 50 });
    const state = createCombatState(enemy, 100, 100, 5);
    // Simulate some answers
    state.stats.perfectCount = 2;
    state.stats.correctCount = 1;
    state.stats.partialCount = 1;
    state.stats.wrongCount = 1;

    const rewards = getCombatRewards(state, enemy, 10, 5, 10);

    // Manual calculation:
    // totalAnswers = 5
    // weightedSum = 2*1.5 + 1*1.0 + 1*0.5 + 1*0.25 = 3.0 + 1.0 + 0.5 + 0.25 = 4.75
    // qualityMultiplier = 4.75 / 5 = 0.95
    // streakBonusPct=10, equipXpBonusPct=0, classXpBonusPct=5
    // totalBonusPct = 10 + 0 + 5 = 15
    // xp = floor(100 * 0.95 * (1 + 15/100)) = floor(100 * 0.95 * 1.15) = floor(109.25) = 109
    expect(rewards.xp).toBe(109);

    // gold = floor(50 * (1 + 10/100)) = floor(50 * 1.1) = floor(55) = 55
    expect(rewards.gold).toBe(55);
  });

  it("returns 0 xp when no answers given", () => {
    const enemy = makeEnemy({ xpReward: 100, goldReward: 50 });
    const state = createCombatState(enemy, 100, 100, 5);
    // stats all zero

    const rewards = getCombatRewards(state, enemy, 0, 0, 0);
    expect(rewards.xp).toBe(0);
    expect(rewards.gold).toBe(50); // base gold, no bonus
  });
});

describe("confidence-based damage", () => {
  const playerAttack = 10;
  const playerDefense = 3;
  const critChance = 0;
  const noCritRng = () => 1;

  it("Perfect+Instant deals more than Perfect+Knew", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event: instantEvent } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
      ConfidenceLevel.Instant,
    );
    const { event: knewEvent } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
      ConfidenceLevel.Knew,
    );

    // Instant: floor(10 * 2.5) = 25, Knew: floor(10 * 2.0) = 20
    expect(instantEvent.damage).toBe(25);
    expect(knewEvent.damage).toBe(20);
    expect(instantEvent.damage).toBeGreaterThan(knewEvent.damage);
  });

  it("Perfect+Guess deals less than Perfect+Knew", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event: guessEvent } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
      ConfidenceLevel.Guess,
    );
    const { event: knewEvent } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
      ConfidenceLevel.Knew,
    );

    // Guess: floor(10 * 1.0) = 10, Knew: floor(10 * 2.0) = 20
    expect(guessEvent.damage).toBe(10);
    expect(knewEvent.damage).toBe(20);
    expect(guessEvent.damage).toBeLessThan(knewEvent.damage);
  });

  it("Perfect+Guess uses player_glancing action", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
      ConfidenceLevel.Guess,
    );

    expect(event.action).toBe("player_glancing");
  });

  it("Correct+Instant deals 1.5x", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Correct, playerAttack, playerDefense, critChance, noCritRng,
      ConfidenceLevel.Instant,
    );

    // floor(10 * 1.5) = 15
    expect(event.damage).toBe(15);
    expect(event.action).toBe("player_attack");
  });

  it("Correct+Guess deals 0.5x and uses player_glancing", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Correct, playerAttack, playerDefense, critChance, noCritRng,
      ConfidenceLevel.Guess,
    );

    // floor(10 * 0.5) = 5
    expect(event.damage).toBe(5);
    expect(event.action).toBe("player_glancing");
  });

  it("Wrong answer is unaffected by confidence", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event: noConfEvent } = resolveTurn(
      state, AnswerQuality.Wrong, playerAttack, playerDefense, critChance, noCritRng,
    );
    const { event: instantEvent } = resolveTurn(
      state, AnswerQuality.Wrong, playerAttack, playerDefense, critChance, noCritRng,
      ConfidenceLevel.Instant,
    );

    expect(noConfEvent.damage).toBe(instantEvent.damage);
    expect(noConfEvent.damage).toBe(7); // max(1, 10-3)
  });

  it("Timeout is unaffected by confidence", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event: noConfEvent } = resolveTurn(
      state, AnswerQuality.Timeout, playerAttack, playerDefense, critChance, noCritRng,
    );
    const { event: instantEvent } = resolveTurn(
      state, AnswerQuality.Timeout, playerAttack, playerDefense, critChance, noCritRng,
      ConfidenceLevel.Instant,
    );

    expect(noConfEvent.damage).toBe(instantEvent.damage);
    expect(noConfEvent.damage).toBe(7);
  });
});

describe("evolution tier multipliers", () => {
  const playerAttack = 10;
  const playerDefense = 3;
  const critChance = 0;
  const noCritRng = () => 1;

  it("Tier 3 card deals 2x base damage", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
      undefined, 3,
    );

    // Perfect default baseMult=2.0, tier3=2.0x => floor(10 * 2.0 * 2.0 * 1.0) = 40
    expect(event.damage).toBe(40);
  });

  it("Tier 0 is same as default (no tier)", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event: noTierEvent } = resolveTurn(
      state, AnswerQuality.Correct, playerAttack, playerDefense, critChance, noCritRng,
    );
    const { event: tier0Event } = resolveTurn(
      state, AnswerQuality.Correct, playerAttack, playerDefense, critChance, noCritRng,
      undefined, 0,
    );

    expect(noTierEvent.damage).toBe(tier0Event.damage);
    expect(tier0Event.damage).toBe(10);
  });

  it("Tier crit bonus increases effective crit chance", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);

    // critChance=0, tier 3 adds 25% crit bonus => effectiveCrit=25
    // rng returns 0.2 which is < 25/100=0.25, so it crits
    const { event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, 0, () => 0.2,
      undefined, 3,
    );

    // Crit with default confidence: (2.0+0.5) * tier3(2.0) = 5.0 => floor(10*5.0) = 50
    expect(event.action).toBe("player_critical");
    expect(event.damage).toBe(50);
  });

  it("Tier 2 applies crit bonus of 10", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);

    // critChance=5, tier 2 adds 10 => effectiveCrit=15
    // rng returns 0.1 which is < 15/100=0.15, so it crits
    const { event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, 5, () => 0.1,
      undefined, 2,
    );

    // Crit: (2.0+0.5) * tier2(1.5) = 3.75 => floor(10*3.75) = 37
    expect(event.action).toBe("player_critical");
    expect(event.damage).toBe(37);
  });

  it("Tier 1 applies 1.25x damage multiplier", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Correct, playerAttack, playerDefense, critChance, noCritRng,
      undefined, 1,
    );

    // Correct default: floor(10 * 1.0 * 1.25 * 1.0) = floor(12.5) = 12
    expect(event.damage).toBe(12);
  });
});

describe("retrieval mode multipliers", () => {
  const playerAttack = 10;
  const playerDefense = 3;
  const critChance = 0;
  const noCritRng = () => 1;

  it("Teach mode deals 1.5x damage", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Correct, playerAttack, playerDefense, critChance, noCritRng,
      undefined, undefined, RetrievalMode.Teach,
    );

    // Correct default: floor(10 * 1.0 * 1.0 * 1.5) = 15
    expect(event.damage).toBe(15);
  });

  it("Standard mode is same as default (no mode)", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event: noModeEvent } = resolveTurn(
      state, AnswerQuality.Correct, playerAttack, playerDefense, critChance, noCritRng,
    );
    const { event: standardEvent } = resolveTurn(
      state, AnswerQuality.Correct, playerAttack, playerDefense, critChance, noCritRng,
      undefined, undefined, RetrievalMode.Standard,
    );

    expect(noModeEvent.damage).toBe(standardEvent.damage);
    expect(standardEvent.damage).toBe(10);
  });

  it("Reversed mode deals 1.1x damage", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
      undefined, undefined, RetrievalMode.Reversed,
    );

    // Perfect default: floor(10 * 2.0 * 1.0 * 1.1) = floor(22) = 22
    expect(event.damage).toBe(22);
  });

  it("Connect mode deals 1.2x damage", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
      undefined, undefined, RetrievalMode.Connect,
    );

    // Perfect default: floor(10 * 2.0 * 1.0 * 1.2) = floor(24) = 24
    expect(event.damage).toBe(24);
  });
});

describe("combined multipliers", () => {
  const playerAttack = 10;
  const playerDefense = 3;
  const noCritRng = () => 1;

  it("Tier 2 + Teach + Perfect+Instant gives max damage combo", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, 0, noCritRng,
      ConfidenceLevel.Instant, 2, RetrievalMode.Teach,
    );

    // baseMult=2.5, tier2=1.5, teach=1.5 => floor(10 * 2.5 * 1.5 * 1.5) = floor(56.25) = 56
    expect(event.damage).toBe(56);
    expect(event.action).toBe("player_attack");
  });

  it("Tier 3 + Teach + Perfect+Instant + crit gives maximum possible damage", () => {
    const state = createCombatState(makeEnemy({ hp: 1000 }), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, 100, () => 0,
      ConfidenceLevel.Instant, 3, RetrievalMode.Teach,
    );

    // baseMult=2.5, crit adds 0.5 => 3.0, tier3=2.0, teach=1.5 => floor(10 * 3.0 * 2.0 * 1.5) = 90
    expect(event.damage).toBe(90);
    expect(event.action).toBe("player_critical");
  });

  it("Guess + Tier 1 + Reversed on Correct gives reduced damage", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Correct, playerAttack, playerDefense, 0, noCritRng,
      ConfidenceLevel.Guess, 1, RetrievalMode.Reversed,
    );

    // baseMult=0.5, tier1=1.25, reversed=1.1 => floor(10 * 0.5 * 1.25 * 1.1) = floor(6.875) = 6
    expect(event.damage).toBe(6);
    expect(event.action).toBe("player_glancing");
  });

  it("Partial applies tier and mode but not confidence", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Partial, playerAttack, playerDefense, 0, noCritRng,
      ConfidenceLevel.Instant, 2, RetrievalMode.Teach,
    );

    // Partial: floor(10 * 0.5 * 1.5 * 1.5) = floor(11.25) = 11
    expect(event.damage).toBe(11);
    expect(event.action).toBe("player_glancing");
  });
});
