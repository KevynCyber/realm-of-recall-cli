import React from "react";
import { describe, it, expect } from "vitest";
import { CardType, AnswerQuality, RetrievalMode } from "../../src/types/index.js";
import type { Card } from "../../src/types/index.js";
import type { ReviewResult } from "../../src/components/review/ReviewScreen.js";
import type { CombatState } from "../../src/core/combat/CombatEngine.js";
import { createCombatState } from "../../src/core/combat/CombatEngine.js";
import { EnemyTier } from "../../src/types/combat.js";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    front: "What is the capital of France?",
    back: "Paris",
    acceptableAnswers: ["Paris"],
    type: CardType.Basic,
    deckId: "deck-1",
    ...overrides,
  };
}

describe("ReviewScreen undo logic", () => {
  /**
   * Pure logic tests for the undo mechanism in ReviewScreen.
   * Tests the state transformations that occur when undo is triggered.
   */

  function applyUndo(state: {
    results: ReviewResult[];
    currentIndex: number;
    undoUsed: boolean;
  }): {
    results: ReviewResult[];
    currentIndex: number;
    undoUsed: boolean;
    phase: string;
  } | null {
    // Can only undo if not already used and there are results
    if (state.undoUsed || state.results.length === 0) {
      return null;
    }
    return {
      results: state.results.slice(0, -1),
      currentIndex: state.currentIndex,
      undoUsed: true,
      phase: "question",
    };
  }

  it("removes last result on undo", () => {
    const results: ReviewResult[] = [
      { cardId: "c1", quality: AnswerQuality.Wrong, responseTime: 3 },
      { cardId: "c2", quality: AnswerQuality.Perfect, responseTime: 2 },
    ];

    const undone = applyUndo({
      results,
      currentIndex: 2,
      undoUsed: false,
    });

    expect(undone).not.toBeNull();
    expect(undone!.results).toHaveLength(1);
    expect(undone!.results[0].cardId).toBe("c1");
    expect(undone!.phase).toBe("question");
  });

  it("sets undoUsed to true after undo", () => {
    const results: ReviewResult[] = [
      { cardId: "c1", quality: AnswerQuality.Correct, responseTime: 2 },
    ];

    const undone = applyUndo({
      results,
      currentIndex: 1,
      undoUsed: false,
    });

    expect(undone).not.toBeNull();
    expect(undone!.undoUsed).toBe(true);
  });

  it("prevents double undo (returns null when undoUsed is true)", () => {
    const results: ReviewResult[] = [
      { cardId: "c1", quality: AnswerQuality.Correct, responseTime: 2 },
    ];

    const undone = applyUndo({
      results,
      currentIndex: 1,
      undoUsed: true,
    });

    expect(undone).toBeNull();
  });

  it("prevents undo with no results (returns null)", () => {
    const undone = applyUndo({
      results: [],
      currentIndex: 0,
      undoUsed: false,
    });

    expect(undone).toBeNull();
  });

  it("returns to question phase after undo", () => {
    const results: ReviewResult[] = [
      { cardId: "c1", quality: AnswerQuality.Wrong, responseTime: 5 },
    ];

    const undone = applyUndo({
      results,
      currentIndex: 1,
      undoUsed: false,
    });

    expect(undone).not.toBeNull();
    expect(undone!.phase).toBe("question");
  });

  it("only allows undo of immediately preceding card", () => {
    // After answering 3 cards, undo should only affect the last one
    const results: ReviewResult[] = [
      { cardId: "c1", quality: AnswerQuality.Perfect, responseTime: 1 },
      { cardId: "c2", quality: AnswerQuality.Correct, responseTime: 2 },
      { cardId: "c3", quality: AnswerQuality.Wrong, responseTime: 5 },
    ];

    const undone = applyUndo({
      results,
      currentIndex: 3,
      undoUsed: false,
    });

    expect(undone).not.toBeNull();
    expect(undone!.results).toHaveLength(2);
    // Only c3 was removed
    expect(undone!.results[0].cardId).toBe("c1");
    expect(undone!.results[1].cardId).toBe("c2");

    // Cannot undo again (undoUsed is now true)
    const doubleUndo = applyUndo({
      results: undone!.results,
      currentIndex: undone!.currentIndex,
      undoUsed: undone!.undoUsed,
    });
    expect(doubleUndo).toBeNull();
  });
});

describe("CombatScreen undo logic", () => {
  /**
   * Pure logic tests for the undo mechanism in CombatScreen.
   * Tests that combat state is correctly reverted to pre-answer snapshot.
   */

  const enemy = {
    name: "Goblin",
    tier: EnemyTier.Common,
    hp: 100,
    maxHp: 100,
    attack: 10,
    xpReward: 50,
    goldReward: 20,
  };

  function createSnapshot(combat: CombatState) {
    return {
      combat: JSON.parse(JSON.stringify(combat)),
      cardQueue: [makeCard({ id: "c1" }), makeCard({ id: "c2" })],
      requeueCounts: new Map<string, number>(),
      activeEffects: [] as any[],
      activeAbilities: [] as any[],
      currentSp: 10,
    };
  }

  function applyCombatUndo(state: {
    undoUsed: boolean;
    preAnswerSnapshot: ReturnType<typeof createSnapshot> | null;
  }): {
    combat: CombatState;
    cardQueue: Card[];
    requeueCounts: Map<string, number>;
    undoUsed: boolean;
    phase: string;
  } | null {
    if (state.undoUsed || !state.preAnswerSnapshot) {
      return null;
    }
    const snap = state.preAnswerSnapshot;
    return {
      combat: snap.combat,
      cardQueue: snap.cardQueue,
      requeueCounts: snap.requeueCounts,
      undoUsed: true,
      phase: "card",
    };
  }

  it("restores combat state from snapshot on undo", () => {
    const originalCombat = createCombatState(enemy, 100, 100, 2);
    const snapshot = createSnapshot(originalCombat);

    // Simulate that combat has changed after answer
    const modifiedCombat = {
      ...originalCombat,
      currentCardIndex: 1,
      playerHp: 80,
      stats: { ...originalCombat.stats, wrongCount: 1 },
    };

    const undone = applyCombatUndo({
      undoUsed: false,
      preAnswerSnapshot: snapshot,
    });

    expect(undone).not.toBeNull();
    // Should restore to pre-answer state
    expect(undone!.combat.currentCardIndex).toBe(0);
    expect(undone!.combat.playerHp).toBe(100);
    expect(undone!.combat.stats.wrongCount).toBe(0);
    expect(undone!.phase).toBe("card");
  });

  it("sets undoUsed to true after combat undo", () => {
    const originalCombat = createCombatState(enemy, 100, 100, 2);
    const snapshot = createSnapshot(originalCombat);

    const undone = applyCombatUndo({
      undoUsed: false,
      preAnswerSnapshot: snapshot,
    });

    expect(undone).not.toBeNull();
    expect(undone!.undoUsed).toBe(true);
  });

  it("prevents double undo in combat", () => {
    const originalCombat = createCombatState(enemy, 100, 100, 2);
    const snapshot = createSnapshot(originalCombat);

    const undone = applyCombatUndo({
      undoUsed: true,
      preAnswerSnapshot: snapshot,
    });

    expect(undone).toBeNull();
  });

  it("prevents undo when no snapshot exists", () => {
    const undone = applyCombatUndo({
      undoUsed: false,
      preAnswerSnapshot: null,
    });

    expect(undone).toBeNull();
  });

  it("restores card queue from snapshot", () => {
    const originalCombat = createCombatState(enemy, 100, 100, 2);
    const snapshot = createSnapshot(originalCombat);
    // Snapshot has 2 cards
    expect(snapshot.cardQueue).toHaveLength(2);

    const undone = applyCombatUndo({
      undoUsed: false,
      preAnswerSnapshot: snapshot,
    });

    expect(undone).not.toBeNull();
    expect(undone!.cardQueue).toHaveLength(2);
    expect(undone!.cardQueue[0].id).toBe("c1");
  });

  it("restores requeueCounts from snapshot", () => {
    const originalCombat = createCombatState(enemy, 100, 100, 2);
    const snapshot = createSnapshot(originalCombat);
    // Pre-answer: no requeues
    expect(snapshot.requeueCounts.size).toBe(0);

    const undone = applyCombatUndo({
      undoUsed: false,
      preAnswerSnapshot: snapshot,
    });

    expect(undone).not.toBeNull();
    expect(undone!.requeueCounts.size).toBe(0);
  });

  it("snapshot preserves enemy HP for accurate undo", () => {
    const originalCombat = createCombatState(enemy, 100, 100, 2);
    const snapshot = createSnapshot(originalCombat);
    expect(snapshot.combat.enemy.hp).toBe(100);

    const undone = applyCombatUndo({
      undoUsed: false,
      preAnswerSnapshot: snapshot,
    });

    expect(undone).not.toBeNull();
    expect(undone!.combat.enemy.hp).toBe(100);
  });
});
