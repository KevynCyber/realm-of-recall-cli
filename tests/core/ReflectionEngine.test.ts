import { describe, it, expect } from "vitest";
import {
  REFLECTION_PROMPTS,
  selectPrompt,
  shouldShowJournal,
  calculateWisdomXP,
  generateCPJReframe,
  shouldShowCPJ,
} from "../../src/core/reflection/ReflectionEngine.js";

// ---------------------------------------------------------------------------
// selectPrompt
// ---------------------------------------------------------------------------
describe("selectPrompt", () => {
  it("never returns the same prompt as previousPrompt (50 iterations)", () => {
    let i = 0;
    const rng = () => {
      // Cycle through values to exercise different indices
      i++;
      return (i * 7 + 3) % 100 / 100;
    };

    const previous = REFLECTION_PROMPTS[0];
    for (let n = 0; n < 50; n++) {
      const result = selectPrompt(previous, rng);
      expect(result).not.toBe(previous);
      expect(REFLECTION_PROMPTS).toContain(result);
    }
  });

  it("works with null previousPrompt", () => {
    const rng = () => 0.5;
    const result = selectPrompt(null, rng);
    expect(REFLECTION_PROMPTS).toContain(result);
  });
});

// ---------------------------------------------------------------------------
// shouldShowJournal
// ---------------------------------------------------------------------------
describe("shouldShowJournal", () => {
  it("returns true ~30% of the time over 1000 calls", () => {
    let i = 0;
    const rng = () => {
      i++;
      return (i % 1000) / 1000;
    };

    let trueCount = 0;
    for (let n = 0; n < 1000; n++) {
      if (shouldShowJournal(rng)) trueCount++;
    }

    // Expect ~300 true values; tolerance +-10% => 200–400
    expect(trueCount).toBeGreaterThanOrEqual(200);
    expect(trueCount).toBeLessThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// calculateWisdomXP
// ---------------------------------------------------------------------------
describe("calculateWisdomXP", () => {
  it("returns 25 for micro-reflection only", () => {
    expect(calculateWisdomXP(true, false)).toBe(25);
  });

  it("returns 50 for journal only", () => {
    expect(calculateWisdomXP(false, true)).toBe(50);
  });

  it("returns 75 for both", () => {
    expect(calculateWisdomXP(true, true)).toBe(75);
  });

  it("returns 0 for neither", () => {
    expect(calculateWisdomXP(false, false)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// shouldShowCPJ
// ---------------------------------------------------------------------------
describe("shouldShowCPJ", () => {
  it("returns false at 70% accuracy", () => {
    expect(shouldShowCPJ(0.7)).toBe(false);
  });

  it("returns false above 70% accuracy", () => {
    expect(shouldShowCPJ(0.85)).toBe(false);
  });

  it("returns true at 69% accuracy", () => {
    expect(shouldShowCPJ(0.69)).toBe(true);
  });

  it("returns true at 0% accuracy", () => {
    expect(shouldShowCPJ(0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateCPJReframe
// ---------------------------------------------------------------------------
describe("generateCPJReframe", () => {
  it("returns empty array when accuracy >= 0.7", () => {
    expect(generateCPJReframe(0.7, [])).toEqual([]);
    expect(generateCPJReframe(0.95, [0.5, 0.6])).toEqual([]);
  });

  it("triggers at 69% accuracy", () => {
    const result = generateCPJReframe(0.69, [], () => 0.5);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toBe("Tough battle — 69% accuracy.");
  });

  it("includes journey context when improving", () => {
    // Previous average: (0.3 + 0.4) / 2 = 0.35 => 35%
    // Current: 0.5 > 0.35, so journey context should appear
    const result = generateCPJReframe(0.5, [0.3, 0.4], () => 0.5);
    expect(result.length).toBe(3);
    expect(result[2]).toBe("Your average was 35%. You're getting stronger.");
  });

  it("has no journey context when no history", () => {
    const result = generateCPJReframe(0.5, [], () => 0.5);
    expect(result.length).toBe(2);
  });

  it("has no journey context when not improving", () => {
    // Previous average: (0.6 + 0.65) / 2 = 0.625 => current 0.5 < 0.625
    const result = generateCPJReframe(0.5, [0.6, 0.65], () => 0.5);
    expect(result.length).toBe(2);
  });

  it("reframe pool messages are non-empty strings", () => {
    // Exercise all reframe indices by varying rng
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const rng = () => i / 50;
      const result = generateCPJReframe(0.4, [], rng);
      expect(result.length).toBeGreaterThanOrEqual(2);
      const reframe = result[1];
      expect(typeof reframe).toBe("string");
      expect(reframe.length).toBeGreaterThan(0);
      seen.add(reframe);
    }
    // Should have seen multiple distinct reframe messages
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
});
