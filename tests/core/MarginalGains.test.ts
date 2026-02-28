import { describe, it, expect } from "vitest";
import {
  generateSparkline,
  calculateTrend,
  calculateConfidenceCalibration,
  projectMastery,
  formatConsistencyGrid,
} from "../../src/core/analytics/MarginalGains.js";

// ---------- generateSparkline ----------

describe("generateSparkline", () => {
  it("maps ascending values to ascending block chars", () => {
    const result = generateSparkline([1, 2, 3, 4, 5]);
    expect(result).toBe("\u2581\u2582\u2584\u2586\u2588");
  });

  it("returns empty string for empty array", () => {
    expect(generateSparkline([])).toBe("");
  });

  it("returns middle char for single value", () => {
    expect(generateSparkline([42])).toBe("\u2585");
  });

  it("returns same char for flat values", () => {
    const result = generateSparkline([5, 5, 5]);
    // All same value -> all mapped to same char (index 4 = ▅)
    expect(result[0]).toBe(result[1]);
    expect(result[1]).toBe(result[2]);
    expect(result.length).toBe(3);
  });
});

// ---------- calculateTrend ----------

describe("calculateTrend", () => {
  it("detects improving trend for ascending accuracy (higherIsBetter=true)", () => {
    // 14 values: first 7 low, last 7 high
    const values = [50, 52, 51, 53, 50, 51, 52, 70, 72, 71, 73, 70, 71, 72];
    const result = calculateTrend(values, true);

    expect(result.trend).toBe("improving");
    expect(result.current).toBeGreaterThan(result.previous);
    expect(result.percentChange).toBeGreaterThan(2);
    expect(result.sparkline.length).toBe(14);
  });

  it("detects declining trend for descending values (higherIsBetter=true)", () => {
    const values = [80, 82, 81, 83, 80, 81, 82, 50, 52, 51, 53, 50, 51, 52];
    const result = calculateTrend(values, true);

    expect(result.trend).toBe("declining");
    expect(result.current).toBeLessThan(result.previous);
    expect(result.percentChange).toBeLessThan(-2);
  });

  it("detects stable trend when values are within 2%", () => {
    // Previous avg ~100, current avg ~101 => ~1% change
    const values = [100, 100, 100, 100, 100, 100, 100, 101, 101, 101, 101, 101, 101, 101];
    const result = calculateTrend(values, true);

    expect(result.trend).toBe("stable");
    expect(Math.abs(result.percentChange)).toBeLessThan(2);
  });

  it("handles fewer than 7 values (all treated as recent, previous=0)", () => {
    const result = calculateTrend([80, 85, 90], true);

    expect(result.current).toBeCloseTo(85, 0);
    expect(result.previous).toBe(0);
  });

  it("inverts trend direction when higherIsBetter is false", () => {
    // Values decreasing -> improving when lower is better
    const values = [80, 82, 81, 83, 80, 81, 82, 50, 52, 51, 53, 50, 51, 52];
    const result = calculateTrend(values, false);

    expect(result.trend).toBe("improving");
  });
});

// ---------- calculateConfidenceCalibration ----------

describe("calculateConfidenceCalibration", () => {
  it("returns 100% when all confidence ratings match outcomes", () => {
    const attempts = [
      { correct: true, confidence: "instant" },
      { correct: false, confidence: "guess" },
    ];
    expect(calculateConfidenceCalibration(attempts)).toBe(100);
  });

  it("returns lower % when there are mismatches", () => {
    const attempts = [
      { correct: true, confidence: "instant" },  // match
      { correct: true, confidence: "guess" },     // mismatch
      { correct: false, confidence: "instant" },  // mismatch
      { correct: true, confidence: "knew" },      // match
    ];
    expect(calculateConfidenceCalibration(attempts)).toBe(50);
  });

  it("returns 0 for empty attempts array", () => {
    expect(calculateConfidenceCalibration([])).toBe(0);
  });

  it("counts 'knew' + correct as match", () => {
    const attempts = [{ correct: true, confidence: "knew" }];
    expect(calculateConfidenceCalibration(attempts)).toBe(100);
  });
});

// ---------- projectMastery ----------

describe("projectMastery", () => {
  it("projects mastery with a positive rate", () => {
    const result = projectMastery(50, 2, 100);

    expect(result.daysToComplete).toBe(25); // (100-50)/2 = 25
    expect(result.projectedIn30Days).toBe(100); // 50+2*30=110, capped at totalCards=100
  });

  it("returns -1 for daysToComplete when rate is zero", () => {
    const result = projectMastery(50, 0, 100);

    expect(result.daysToComplete).toBe(-1);
    expect(result.projectedIn30Days).toBe(50); // no progress
  });

  it("returns -1 for daysToComplete when rate is negative", () => {
    const result = projectMastery(50, -1, 100);

    expect(result.daysToComplete).toBe(-1);
  });

  it("caps projectedIn30Days at totalCards", () => {
    const result = projectMastery(90, 5, 100);

    expect(result.projectedIn30Days).toBe(100);
  });
});

// ---------- formatConsistencyGrid ----------

describe("formatConsistencyGrid", () => {
  it("renders mixed active/inactive days correctly", () => {
    const days = [
      true, false, true, true, false, false, true,
      true, true, false, true, false, true, true,
    ];
    const result = formatConsistencyGrid(days);

    expect(result).toBe(
      "\u25a0 \u25a1 \u25a0 \u25a0 \u25a1 \u25a1 \u25a0 \u25a0 \u25a0 \u25a1 \u25a0 \u25a1 \u25a0 \u25a0",
    );
  });

  it("renders all active days", () => {
    const result = formatConsistencyGrid([true, true, true]);
    expect(result).toBe("\u25a0 \u25a0 \u25a0");
  });

  it("renders all inactive days", () => {
    const result = formatConsistencyGrid([false, false]);
    expect(result).toBe("\u25a1 \u25a1");
  });

  it("returns empty string for empty array", () => {
    expect(formatConsistencyGrid([])).toBe("");
  });
});
