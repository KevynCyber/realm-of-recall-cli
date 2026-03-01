import { describe, it, expect } from "vitest";
import {
  selectMode,
  getModeDamageMultiplier,
} from "../../../src/core/review/ModeSelector.js";
import {
  createCombatState,
  resolveTurn,
} from "../../../src/core/combat/CombatEngine.js";
import { AnswerQuality, RetrievalMode } from "../../../src/types/index.js";
import { EnemyTier } from "../../../src/types/combat.js";
import type { Enemy } from "../../../src/types/combat.js";

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

describe("mode selection wiring into review flow", () => {
  it("selectMode returns a valid RetrievalMode", () => {
    const validModes = new Set(Object.values(RetrievalMode));
    const mode = selectMode("review", [], []);
    expect(validModes.has(mode)).toBe(true);
  });

  it("selectMode can be called with review card state to get varied modes", () => {
    const seen = new Set<RetrievalMode>();
    for (let i = 0; i < 200; i++) {
      seen.add(selectMode("review", [], []));
    }
    // With enough samples, we should see at least Standard and one other mode
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it("session mode tracking prevents repetition (variety rule)", () => {
    // If the last 3 session modes are Standard, next cannot be Standard
    const sessionModes: RetrievalMode[] = [
      RetrievalMode.Standard,
      RetrievalMode.Standard,
      RetrievalMode.Standard,
    ];
    for (let i = 0; i < 50; i++) {
      const mode = selectMode("review", [], sessionModes);
      expect(mode).not.toBe(RetrievalMode.Standard);
    }
  });

  it("selected mode accumulates in session modes array", () => {
    // Simulates what App.tsx does: push each selected mode into sessionModes
    const sessionModes: RetrievalMode[] = [];
    for (let i = 0; i < 5; i++) {
      const mode = selectMode("review", [], sessionModes);
      sessionModes.push(mode);
    }
    expect(sessionModes.length).toBe(5);
    // All values should be valid RetrievalModes
    const validModes = new Set(Object.values(RetrievalMode));
    for (const m of sessionModes) {
      expect(validModes.has(m)).toBe(true);
    }
  });
});

describe("mode selection wiring into combat flow", () => {
  const playerAttack = 10;
  const playerDefense = 3;
  const noCritRng = () => 1;

  it("Connect mode 1.2x multiplier flows through resolveTurn", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state,
      AnswerQuality.Correct,
      playerAttack,
      playerDefense,
      0,
      noCritRng,
      undefined,
      undefined,
      RetrievalMode.Connect,
    );

    // Correct base 1.0, Connect 1.2x => floor(10 * 1.0 * 1.0 * 1.2) = 12
    expect(event.damage).toBe(12);
    expect(getModeDamageMultiplier(RetrievalMode.Connect)).toBe(1.2);
  });

  it("Reversed mode 1.1x multiplier flows through resolveTurn", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state,
      AnswerQuality.Correct,
      playerAttack,
      playerDefense,
      0,
      noCritRng,
      undefined,
      undefined,
      RetrievalMode.Reversed,
    );

    // Correct base 1.0, Reversed 1.1x => floor(10 * 1.0 * 1.0 * 1.1) = 11
    expect(event.damage).toBe(11);
  });

  it("Teach mode 1.5x multiplier flows through resolveTurn", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state,
      AnswerQuality.Correct,
      playerAttack,
      playerDefense,
      0,
      noCritRng,
      undefined,
      undefined,
      RetrievalMode.Teach,
    );

    // Correct base 1.0, Teach 1.5x => floor(10 * 1.0 * 1.0 * 1.5) = 15
    expect(event.damage).toBe(15);
  });

  it("Standard mode deals same damage as no mode specified", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event: noMode } = resolveTurn(
      state,
      AnswerQuality.Correct,
      playerAttack,
      playerDefense,
      0,
      noCritRng,
    );
    const { event: standardMode } = resolveTurn(
      state,
      AnswerQuality.Correct,
      playerAttack,
      playerDefense,
      0,
      noCritRng,
      undefined,
      undefined,
      RetrievalMode.Standard,
    );

    expect(noMode.damage).toBe(standardMode.damage);
    expect(standardMode.damage).toBe(10);
  });

  it("selectMode can be used to select a mode for combat with review card state", () => {
    // Simulates what App.tsx prepareCombat does
    const sessionModes: RetrievalMode[] = [];
    const mode = selectMode("review", [], sessionModes);

    // The returned mode should be valid
    expect(Object.values(RetrievalMode)).toContain(mode);

    // And when passed to resolveTurn, it should work
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state,
      AnswerQuality.Correct,
      playerAttack,
      playerDefense,
      0,
      noCritRng,
      undefined,
      undefined,
      mode,
    );

    const expectedDamage = Math.floor(10 * 1.0 * 1.0 * getModeDamageMultiplier(mode));
    expect(event.damage).toBe(expectedDamage);
  });
});
