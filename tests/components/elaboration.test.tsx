import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AnswerQuality } from "../../src/types/index.js";
import type { ReviewResult } from "../../src/components/review/ReviewScreen.js";

describe("Elaborative interrogation logic", () => {
  /**
   * Pure logic tests for the elaborative interrogation feature (US-017).
   * Tests the eligibility rules, frequency, and XP award calculations.
   */

  /** Determines if a card is eligible for an elaboration prompt. */
  function isElaborationEligible(
    quality: AnswerQuality,
    evolutionTier: number,
  ): boolean {
    const isCorrect =
      quality === AnswerQuality.Perfect ||
      quality === AnswerQuality.Correct;
    return isCorrect && evolutionTier >= 1;
  }

  /** Simulates the elaboration roll at a given probability. */
  function shouldShowElaboration(roll: number, threshold = 0.3): boolean {
    return roll < threshold;
  }

  /** Calculates bonus wisdom XP from elaboration explanations. */
  function calculateElaborationWisdomXp(results: ReviewResult[]): number {
    const elaborationCount = results.filter((r) => r.elaborationText).length;
    return elaborationCount * 15;
  }

  // ----- Eligibility tests -----

  it("shows elaboration for Perfect answer on tier >= 1 card", () => {
    expect(isElaborationEligible(AnswerQuality.Perfect, 1)).toBe(true);
    expect(isElaborationEligible(AnswerQuality.Perfect, 2)).toBe(true);
    expect(isElaborationEligible(AnswerQuality.Perfect, 3)).toBe(true);
  });

  it("shows elaboration for Correct answer on tier >= 1 card", () => {
    expect(isElaborationEligible(AnswerQuality.Correct, 1)).toBe(true);
    expect(isElaborationEligible(AnswerQuality.Correct, 2)).toBe(true);
  });

  it("does NOT show elaboration for tier 0 cards (new cards)", () => {
    expect(isElaborationEligible(AnswerQuality.Perfect, 0)).toBe(false);
    expect(isElaborationEligible(AnswerQuality.Correct, 0)).toBe(false);
  });

  it("does NOT show elaboration for Wrong answers", () => {
    expect(isElaborationEligible(AnswerQuality.Wrong, 1)).toBe(false);
    expect(isElaborationEligible(AnswerQuality.Wrong, 2)).toBe(false);
  });

  it("does NOT show elaboration for Partial answers", () => {
    expect(isElaborationEligible(AnswerQuality.Partial, 1)).toBe(false);
    expect(isElaborationEligible(AnswerQuality.Partial, 2)).toBe(false);
  });

  it("does NOT show elaboration for Timeout answers", () => {
    expect(isElaborationEligible(AnswerQuality.Timeout, 1)).toBe(false);
    expect(isElaborationEligible(AnswerQuality.Timeout, 3)).toBe(false);
  });

  // ----- Frequency tests -----

  it("triggers elaboration when roll is below 0.3 threshold", () => {
    expect(shouldShowElaboration(0.0)).toBe(true);
    expect(shouldShowElaboration(0.1)).toBe(true);
    expect(shouldShowElaboration(0.29)).toBe(true);
  });

  it("does NOT trigger elaboration when roll is at or above 0.3 threshold", () => {
    expect(shouldShowElaboration(0.3)).toBe(false);
    expect(shouldShowElaboration(0.5)).toBe(false);
    expect(shouldShowElaboration(0.99)).toBe(false);
  });

  it("triggers approximately 30% of the time over many rolls", () => {
    let triggerCount = 0;
    const totalRolls = 10000;
    for (let i = 0; i < totalRolls; i++) {
      if (shouldShowElaboration(Math.random())) {
        triggerCount++;
      }
    }
    const ratio = triggerCount / totalRolls;
    // Allow 5% tolerance
    expect(ratio).toBeGreaterThan(0.25);
    expect(ratio).toBeLessThan(0.35);
  });

  // ----- XP award tests -----

  it("awards 15 wisdom XP per elaboration explanation", () => {
    const results: ReviewResult[] = [
      {
        cardId: "c1",
        quality: AnswerQuality.Perfect,
        responseTime: 2,
        elaborationText: "Because Paris is the capital city of France.",
      },
    ];
    expect(calculateElaborationWisdomXp(results)).toBe(15);
  });

  it("awards 30 wisdom XP for two elaboration explanations", () => {
    const results: ReviewResult[] = [
      {
        cardId: "c1",
        quality: AnswerQuality.Perfect,
        responseTime: 2,
        elaborationText: "Explanation 1",
      },
      {
        cardId: "c2",
        quality: AnswerQuality.Correct,
        responseTime: 3,
        elaborationText: "Explanation 2",
      },
    ];
    expect(calculateElaborationWisdomXp(results)).toBe(30);
  });

  it("awards 0 wisdom XP when no elaboration is provided", () => {
    const results: ReviewResult[] = [
      {
        cardId: "c1",
        quality: AnswerQuality.Perfect,
        responseTime: 2,
      },
      {
        cardId: "c2",
        quality: AnswerQuality.Correct,
        responseTime: 3,
      },
    ];
    expect(calculateElaborationWisdomXp(results)).toBe(0);
  });

  it("awards XP only for results that have elaborationText", () => {
    const results: ReviewResult[] = [
      {
        cardId: "c1",
        quality: AnswerQuality.Perfect,
        responseTime: 2,
        elaborationText: "I know this because...",
      },
      {
        cardId: "c2",
        quality: AnswerQuality.Perfect,
        responseTime: 2,
        // Skipped elaboration (pressed Enter)
      },
      {
        cardId: "c3",
        quality: AnswerQuality.Wrong,
        responseTime: 5,
        // Wrong answer, no elaboration
      },
    ];
    expect(calculateElaborationWisdomXp(results)).toBe(15);
  });

  it("does not count empty string as elaboration", () => {
    const results: ReviewResult[] = [
      {
        cardId: "c1",
        quality: AnswerQuality.Perfect,
        responseTime: 2,
        elaborationText: "",
      },
    ];
    // Empty string is falsy, so no XP
    expect(calculateElaborationWisdomXp(results)).toBe(0);
  });

  // ----- Phase transition tests -----

  it("transitions to elaboration phase for eligible cards", () => {
    // Simulates the phase transition logic from feedback phase
    function getNextPhaseAfterFeedback(
      quality: AnswerQuality,
      tier: number,
      roll: number,
    ): string {
      if (
        quality === AnswerQuality.Perfect ||
        quality === AnswerQuality.Correct
      ) {
        if (tier >= 1 && roll < 0.3) {
          return "elaboration";
        }
        return "confidence";
      }
      return "advance"; // wrong/partial/timeout -> advance
    }

    // Eligible: correct, tier 1, roll 0.1 (< 0.3)
    expect(getNextPhaseAfterFeedback(AnswerQuality.Correct, 1, 0.1)).toBe(
      "elaboration",
    );
    // Eligible but roll too high: correct, tier 1, roll 0.5
    expect(getNextPhaseAfterFeedback(AnswerQuality.Correct, 1, 0.5)).toBe(
      "confidence",
    );
    // Not eligible: tier 0
    expect(getNextPhaseAfterFeedback(AnswerQuality.Perfect, 0, 0.1)).toBe(
      "confidence",
    );
    // Not eligible: wrong answer
    expect(getNextPhaseAfterFeedback(AnswerQuality.Wrong, 2, 0.1)).toBe(
      "advance",
    );
  });

  it("transitions from elaboration to confidence after submitting", () => {
    // After elaboration (with or without text), the next phase is always confidence
    function getNextPhaseAfterElaboration(_text: string): string {
      return "confidence";
    }

    expect(getNextPhaseAfterElaboration("My explanation")).toBe("confidence");
    expect(getNextPhaseAfterElaboration("")).toBe("confidence");
  });

  // ----- Result attachment tests -----

  it("attaches elaborationText to the result when provided", () => {
    function applyElaboration(
      result: ReviewResult,
      text: string,
    ): ReviewResult {
      const trimmed = text.trim();
      if (trimmed) {
        return { ...result, responseText: trimmed, elaborationText: trimmed };
      }
      return result;
    }

    const result: ReviewResult = {
      cardId: "c1",
      quality: AnswerQuality.Perfect,
      responseTime: 2,
    };

    const updated = applyElaboration(result, "Because X leads to Y");
    expect(updated.elaborationText).toBe("Because X leads to Y");
    expect(updated.responseText).toBe("Because X leads to Y");
  });

  it("does NOT attach elaborationText when user skips (empty input)", () => {
    function applyElaboration(
      result: ReviewResult,
      text: string,
    ): ReviewResult {
      const trimmed = text.trim();
      if (trimmed) {
        return { ...result, responseText: trimmed, elaborationText: trimmed };
      }
      return result;
    }

    const result: ReviewResult = {
      cardId: "c1",
      quality: AnswerQuality.Correct,
      responseTime: 3,
    };

    const updated = applyElaboration(result, "");
    expect(updated.elaborationText).toBeUndefined();
    expect(updated.responseText).toBeUndefined();
  });

  it("trims whitespace from elaboration text", () => {
    function applyElaboration(
      result: ReviewResult,
      text: string,
    ): ReviewResult {
      const trimmed = text.trim();
      if (trimmed) {
        return { ...result, responseText: trimmed, elaborationText: trimmed };
      }
      return result;
    }

    const result: ReviewResult = {
      cardId: "c1",
      quality: AnswerQuality.Perfect,
      responseTime: 2,
    };

    const updated = applyElaboration(result, "  some text  ");
    expect(updated.elaborationText).toBe("some text");
  });

  it("does NOT attach elaborationText for whitespace-only input", () => {
    function applyElaboration(
      result: ReviewResult,
      text: string,
    ): ReviewResult {
      const trimmed = text.trim();
      if (trimmed) {
        return { ...result, responseText: trimmed, elaborationText: trimmed };
      }
      return result;
    }

    const result: ReviewResult = {
      cardId: "c1",
      quality: AnswerQuality.Perfect,
      responseTime: 2,
    };

    const updated = applyElaboration(result, "   ");
    expect(updated.elaborationText).toBeUndefined();
  });
});
