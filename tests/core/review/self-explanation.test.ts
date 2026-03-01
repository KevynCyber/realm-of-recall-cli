import { describe, it, expect } from "vitest";
import {
  shouldPromptExplanation,
  generateExplanationPrompt,
  isValidExplanation,
  EXPLANATION_TRIGGER_RATE,
  MIN_CONSECUTIVE_CORRECT,
  MIN_EXPLANATION_LENGTH,
  EXPLANATION_WXP_BONUS,
} from "../../../src/core/review/SelfExplanation.js";

describe("shouldPromptExplanation", () => {
  const alwaysTrigger = () => 0; // below 0.25 threshold
  const neverTrigger = () => 1; // above 0.25 threshold

  describe("card state eligibility", () => {
    it("returns true for 'review' state when other conditions met", () => {
      expect(shouldPromptExplanation("review", 3, alwaysTrigger)).toBe(true);
    });

    it("returns true for 'mastered' state when other conditions met", () => {
      expect(shouldPromptExplanation("mastered", 5, alwaysTrigger)).toBe(true);
    });

    it("returns false for 'new' state", () => {
      expect(shouldPromptExplanation("new", 10, alwaysTrigger)).toBe(false);
    });

    it("returns false for 'learning' state", () => {
      expect(shouldPromptExplanation("learning", 10, alwaysTrigger)).toBe(false);
    });

    it("returns false for 'relearning' state", () => {
      expect(shouldPromptExplanation("relearning", 10, alwaysTrigger)).toBe(false);
    });

    it("returns false for unknown state", () => {
      expect(shouldPromptExplanation("unknown", 10, alwaysTrigger)).toBe(false);
    });
  });

  describe("consecutiveCorrect threshold", () => {
    it("returns false when consecutiveCorrect is 0", () => {
      expect(shouldPromptExplanation("review", 0, alwaysTrigger)).toBe(false);
    });

    it("returns false when consecutiveCorrect is 1", () => {
      expect(shouldPromptExplanation("review", 1, alwaysTrigger)).toBe(false);
    });

    it("returns true when consecutiveCorrect is exactly 2", () => {
      expect(shouldPromptExplanation("review", 2, alwaysTrigger)).toBe(true);
    });

    it("returns true when consecutiveCorrect is above 2", () => {
      expect(shouldPromptExplanation("review", 10, alwaysTrigger)).toBe(true);
    });
  });

  describe("rng control for deterministic testing", () => {
    it("triggers when rng returns value below EXPLANATION_TRIGGER_RATE", () => {
      const justBelow = () => EXPLANATION_TRIGGER_RATE - 0.01;
      expect(shouldPromptExplanation("review", 3, justBelow)).toBe(true);
    });

    it("does not trigger when rng returns value at EXPLANATION_TRIGGER_RATE", () => {
      const exactly = () => EXPLANATION_TRIGGER_RATE;
      expect(shouldPromptExplanation("review", 3, exactly)).toBe(false);
    });

    it("does not trigger when rng returns value above EXPLANATION_TRIGGER_RATE", () => {
      const above = () => EXPLANATION_TRIGGER_RATE + 0.01;
      expect(shouldPromptExplanation("review", 3, above)).toBe(false);
    });

    it("uses Math.random by default (no crash without rng arg)", () => {
      // Just ensure it doesn't throw — result is non-deterministic
      const result = shouldPromptExplanation("review", 3);
      expect(typeof result).toBe("boolean");
    });
  });
});

describe("generateExplanationPrompt", () => {
  it("returns correctly formatted prompt string", () => {
    const result = generateExplanationPrompt("Capital of France", "Paris");
    expect(result).toBe(
      "Why is 'Paris' the answer to 'Capital of France'? Explain in your own words.",
    );
  });

  it("includes both front and back in the output", () => {
    const result = generateExplanationPrompt("2 + 2", "4");
    expect(result).toContain("2 + 2");
    expect(result).toContain("4");
  });

  it("handles empty strings without crashing", () => {
    const result = generateExplanationPrompt("", "");
    expect(result).toBe(
      "Why is '' the answer to ''? Explain in your own words.",
    );
  });

  it("handles special characters in card text", () => {
    const result = generateExplanationPrompt(
      "What is O(n log n)?",
      "Merge sort's time complexity",
    );
    expect(result).toContain("O(n log n)");
    expect(result).toContain("Merge sort's time complexity");
  });
});

describe("isValidExplanation", () => {
  it("accepts explanation at exactly MIN_EXPLANATION_LENGTH characters", () => {
    const text = "a".repeat(MIN_EXPLANATION_LENGTH);
    expect(isValidExplanation(text)).toBe(true);
  });

  it("accepts explanation longer than MIN_EXPLANATION_LENGTH", () => {
    expect(
      isValidExplanation("This is a detailed explanation of the concept."),
    ).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidExplanation("")).toBe(false);
  });

  it("rejects string shorter than MIN_EXPLANATION_LENGTH", () => {
    const text = "a".repeat(MIN_EXPLANATION_LENGTH - 1);
    expect(isValidExplanation(text)).toBe(false);
  });

  it("rejects all-whitespace string", () => {
    expect(isValidExplanation("          ")).toBe(false);
  });

  it("rejects whitespace-padded short string", () => {
    expect(isValidExplanation("   hi   ")).toBe(false);
  });

  it("accepts valid explanation with leading/trailing whitespace", () => {
    expect(isValidExplanation("   This makes sense because of X   ")).toBe(
      true,
    );
  });

  it("rejects tabs and newlines that are effectively whitespace", () => {
    expect(isValidExplanation("\t\n\t\n  \t")).toBe(false);
  });
});

describe("constants", () => {
  it("EXPLANATION_TRIGGER_RATE is 0.25", () => {
    expect(EXPLANATION_TRIGGER_RATE).toBe(0.25);
  });

  it("MIN_CONSECUTIVE_CORRECT is 2", () => {
    expect(MIN_CONSECUTIVE_CORRECT).toBe(2);
  });

  it("MIN_EXPLANATION_LENGTH is 10", () => {
    expect(MIN_EXPLANATION_LENGTH).toBe(10);
  });

  it("EXPLANATION_WXP_BONUS is 8", () => {
    expect(EXPLANATION_WXP_BONUS).toBe(8);
  });
});
