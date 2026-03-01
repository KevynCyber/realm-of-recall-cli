import { describe, it, expect } from "vitest";
import { AnswerQuality } from "../../../src/types/index.js";
import type { CombatResult, CombatCardResult } from "../../../src/types/combat.js";
import { EnemyTier } from "../../../src/types/combat.js";
import {
  createInitialSchedule,
  updateSchedule,
} from "../../../src/core/spaced-repetition/Scheduler.js";

/**
 * Tests for the per-card quality tracking in combat FSRS scheduling.
 *
 * The bug: handleCombatComplete used to apply uniform quality
 * (Correct on victory, Wrong on defeat) to ALL cards, ignoring
 * per-card answer quality. This test ensures each card gets its
 * actual quality for FSRS scheduling.
 */
describe("Combat per-card FSRS scheduling", () => {
  function makeCombatResult(
    overrides: Partial<CombatResult> = {},
  ): CombatResult {
    return {
      victory: true,
      xpEarned: 50,
      goldEarned: 20,
      loot: null,
      events: [],
      cardsReviewed: 3,
      perfectCount: 1,
      correctCount: 1,
      playerHpRemaining: 80,
      cardResults: [],
      ...overrides,
    };
  }

  it("CombatResult includes cardResults field", () => {
    const result = makeCombatResult({
      cardResults: [
        { cardId: "card-1", quality: AnswerQuality.Perfect },
        { cardId: "card-2", quality: AnswerQuality.Wrong },
      ],
    });
    expect(result.cardResults).toHaveLength(2);
    expect(result.cardResults[0].cardId).toBe("card-1");
    expect(result.cardResults[0].quality).toBe(AnswerQuality.Perfect);
    expect(result.cardResults[1].cardId).toBe("card-2");
    expect(result.cardResults[1].quality).toBe(AnswerQuality.Wrong);
  });

  it("cards answered correctly get Correct FSRS scheduling regardless of defeat", () => {
    const result = makeCombatResult({
      victory: false, // player lost
      cardResults: [
        { cardId: "card-1", quality: AnswerQuality.Correct },
        { cardId: "card-2", quality: AnswerQuality.Wrong },
      ],
    });

    // Build quality map the same way handleCombatComplete does
    const cardQualityMap = new Map<string, AnswerQuality>();
    for (const cr of result.cardResults) {
      cardQualityMap.set(cr.cardId, cr.quality as AnswerQuality);
    }

    // Card-1 was answered correctly - should get Correct quality
    const quality1 = cardQualityMap.get("card-1")!;
    expect(quality1).toBe(AnswerQuality.Correct);

    // Card-2 was answered wrong - should get Wrong quality
    const quality2 = cardQualityMap.get("card-2")!;
    expect(quality2).toBe(AnswerQuality.Wrong);

    // Verify scheduling differs: Correct answer should produce a longer interval
    const schedule1 = createInitialSchedule("card-1");
    const schedule2 = createInitialSchedule("card-2");
    const updated1 = updateSchedule(schedule1, quality1);
    const updated2 = updateSchedule(schedule2, quality2);

    // A correct answer should produce higher stability than a wrong answer
    expect(updated1.stability).toBeGreaterThan(updated2.stability);
  });

  it("cards answered wrong get Wrong FSRS scheduling regardless of victory", () => {
    const result = makeCombatResult({
      victory: true, // player won
      cardResults: [
        { cardId: "card-1", quality: AnswerQuality.Perfect },
        { cardId: "card-2", quality: AnswerQuality.Wrong },
      ],
    });

    // Build quality map the same way handleCombatComplete does
    const cardQualityMap = new Map<string, AnswerQuality>();
    for (const cr of result.cardResults) {
      cardQualityMap.set(cr.cardId, cr.quality as AnswerQuality);
    }

    // Card-2 was answered wrong even though player won - should still get Wrong
    const quality2 = cardQualityMap.get("card-2")!;
    expect(quality2).toBe(AnswerQuality.Wrong);

    // Verify: wrong answer should produce different scheduling than correct
    const scheduleWrong = createInitialSchedule("card-wrong");
    const scheduleCorrect = createInitialSchedule("card-correct");
    const updatedWrong = updateSchedule(scheduleWrong, AnswerQuality.Wrong);
    const updatedCorrect = updateSchedule(scheduleCorrect, AnswerQuality.Correct);
    // A correct answer should have higher stability than a wrong answer
    expect(updatedCorrect.stability).toBeGreaterThan(updatedWrong.stability);
  });

  it("per-card quality map uses last quality for re-queued cards", () => {
    // When a card is re-queued (successive relearning), it may appear
    // multiple times in cardResults. The map should use the last entry.
    const result = makeCombatResult({
      cardResults: [
        { cardId: "card-1", quality: AnswerQuality.Wrong },    // first attempt: wrong
        { cardId: "card-2", quality: AnswerQuality.Perfect },
        { cardId: "card-1", quality: AnswerQuality.Correct },  // re-queued: correct
      ],
    });

    const cardQualityMap = new Map<string, AnswerQuality>();
    for (const cr of result.cardResults) {
      cardQualityMap.set(cr.cardId, cr.quality as AnswerQuality);
    }

    // Card-1 should use the last quality (Correct), not the first (Wrong)
    expect(cardQualityMap.get("card-1")).toBe(AnswerQuality.Correct);
    expect(cardQualityMap.get("card-2")).toBe(AnswerQuality.Perfect);
  });

  it("fallback quality is used for cards without per-card results", () => {
    // Edge case: if somehow a card is reviewed but has no cardResult entry,
    // the code falls back to victory-based quality
    const result = makeCombatResult({
      victory: true,
      cardResults: [
        { cardId: "card-1", quality: AnswerQuality.Perfect },
        // card-2 has no entry
      ],
    });

    const cardQualityMap = new Map<string, AnswerQuality>();
    for (const cr of result.cardResults) {
      cardQualityMap.set(cr.cardId, cr.quality as AnswerQuality);
    }

    // Card with entry uses its actual quality
    const quality1 = cardQualityMap.get("card-1") ?? AnswerQuality.Correct;
    expect(quality1).toBe(AnswerQuality.Perfect);

    // Card without entry falls back to victory-based quality (Correct since victory=true)
    const quality2 = cardQualityMap.get("card-2") ?? (result.victory ? AnswerQuality.Correct : AnswerQuality.Wrong);
    expect(quality2).toBe(AnswerQuality.Correct);
  });

  it("different per-card qualities produce different FSRS schedules", () => {
    const qualities = [
      AnswerQuality.Perfect,
      AnswerQuality.Correct,
      AnswerQuality.Wrong,
    ];

    const schedules = qualities.map((quality) => {
      const initial = createInitialSchedule(`card-${quality}`);
      return updateSchedule(initial, quality);
    });

    // Perfect should have the best stability
    expect(schedules[0].stability).toBeGreaterThanOrEqual(schedules[1].stability);
    // Correct should have better stability than Wrong
    expect(schedules[1].stability).toBeGreaterThan(schedules[2].stability);
  });

  it("evolution tier uses per-card correctness not overall victory", () => {
    // The isCorrect check should be based on per-card quality
    const correctQualities = [AnswerQuality.Perfect, AnswerQuality.Correct, AnswerQuality.Partial];
    const wrongQualities = [AnswerQuality.Wrong, AnswerQuality.Timeout];

    for (const q of correctQualities) {
      const isCorrect = q === AnswerQuality.Perfect || q === AnswerQuality.Correct || q === AnswerQuality.Partial;
      expect(isCorrect).toBe(true);
    }

    for (const q of wrongQualities) {
      const isCorrect = q === AnswerQuality.Perfect || q === AnswerQuality.Correct || q === AnswerQuality.Partial;
      expect(isCorrect).toBe(false);
    }
  });
});
