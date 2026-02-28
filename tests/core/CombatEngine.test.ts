import { describe, it, expect } from "vitest";
import {
  createCombatState,
  resolveTurn,
  isCombatOver,
  getCombatRewards,
} from "../../src/core/combat/CombatEngine.js";
import { AnswerQuality } from "../../src/types/index.js";
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
