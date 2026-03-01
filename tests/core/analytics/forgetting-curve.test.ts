import { describe, it, expect } from "vitest";
import {
  getRetentionForecast,
  categorizeRetention,
  getCardRetentionSummary,
  getSkipCostForecast,
  HEALTHY_THRESHOLD,
  AT_RISK_THRESHOLD,
  FSRS_DECAY_FACTOR,
} from "../../../src/core/analytics/ForgettingCurve.js";

// ── getRetentionForecast ───────────────────────────────────────────

describe("getRetentionForecast", () => {
  it("returns an array with length equal to daysToForecast", () => {
    const forecast = getRetentionForecast(10, 0, 30);
    expect(forecast).toHaveLength(30);
  });

  it("returns an empty array when daysToForecast is 0", () => {
    expect(getRetentionForecast(10, 0, 0)).toEqual([]);
  });

  it("produces values that decrease over time", () => {
    const forecast = getRetentionForecast(5, 0, 10);
    for (let i = 1; i < forecast.length; i++) {
      expect(forecast[i]).toBeLessThan(forecast[i - 1]);
    }
  });

  it("high stability decays slower than low stability", () => {
    const highStability = getRetentionForecast(50, 0, 30);
    const lowStability = getRetentionForecast(5, 0, 30);

    // At every day, the high-stability card retains more
    for (let i = 0; i < 30; i++) {
      expect(highStability[i]).toBeGreaterThan(lowStability[i]);
    }
  });

  it("all values are between 0 and 1 inclusive", () => {
    const forecast = getRetentionForecast(3, 5, 60);
    for (const r of forecast) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it("follows the FSRS power-law formula R(t) = (1 + t/(9*S))^-1", () => {
    const stability = 10;
    const daysSinceReview = 2;
    const forecast = getRetentionForecast(stability, daysSinceReview, 5);

    for (let day = 1; day <= 5; day++) {
      const t = daysSinceReview + day;
      const expected = Math.pow(1 + t / (FSRS_DECAY_FACTOR * stability), -1);
      expect(forecast[day - 1]).toBeCloseTo(expected, 10);
    }
  });

  it("returns all zeros when stability is 0", () => {
    const forecast = getRetentionForecast(0, 0, 5);
    expect(forecast).toEqual([0, 0, 0, 0, 0]);
  });

  it("handles daysSinceReview of 0 (just reviewed)", () => {
    const forecast = getRetentionForecast(10, 0, 1);
    // t = 1 day after review: R = (1 + 1/90)^-1
    const expected = Math.pow(1 + 1 / (FSRS_DECAY_FACTOR * 10), -1);
    expect(forecast[0]).toBeCloseTo(expected, 10);
  });
});

// ── categorizeRetention ────────────────────────────────────────────

describe("categorizeRetention", () => {
  it("returns 'healthy' at the threshold boundary (0.7)", () => {
    expect(categorizeRetention(HEALTHY_THRESHOLD)).toBe("healthy");
  });

  it("returns 'healthy' for values above the threshold", () => {
    expect(categorizeRetention(0.95)).toBe("healthy");
    expect(categorizeRetention(1.0)).toBe("healthy");
  });

  it("returns 'at_risk' at the at-risk threshold boundary (0.4)", () => {
    expect(categorizeRetention(AT_RISK_THRESHOLD)).toBe("at_risk");
  });

  it("returns 'at_risk' for values between 0.4 and 0.7", () => {
    expect(categorizeRetention(0.5)).toBe("at_risk");
    expect(categorizeRetention(0.69)).toBe("at_risk");
  });

  it("returns 'critical' for values below 0.4", () => {
    expect(categorizeRetention(0.39)).toBe("critical");
    expect(categorizeRetention(0.1)).toBe("critical");
    expect(categorizeRetention(0)).toBe("critical");
  });
});

// ── getCardRetentionSummary ────────────────────────────────────────

describe("getCardRetentionSummary", () => {
  it("returns all zeros for an empty cards array", () => {
    const summary = getCardRetentionSummary([]);
    expect(summary).toEqual({ healthy: 0, atRisk: 0, critical: 0 });
  });

  it("counts healthy cards correctly", () => {
    // High stability, recently reviewed -> healthy
    const cards = [
      { stability: 50, daysSinceReview: 0 },
      { stability: 100, daysSinceReview: 1 },
    ];
    const summary = getCardRetentionSummary(cards);
    expect(summary.healthy).toBe(2);
    expect(summary.atRisk).toBe(0);
    expect(summary.critical).toBe(0);
  });

  it("treats stability=0 as critical", () => {
    const cards = [{ stability: 0, daysSinceReview: 0 }];
    const summary = getCardRetentionSummary(cards);
    expect(summary.critical).toBe(1);
    expect(summary.healthy).toBe(0);
  });

  it("categorizes a mixed set of cards", () => {
    const cards = [
      // healthy: high stability, recent review
      { stability: 50, daysSinceReview: 1 },
      // critical: very low stability, overdue
      { stability: 1, daysSinceReview: 30 },
      // critical: no stability
      { stability: 0, daysSinceReview: 0 },
    ];
    const summary = getCardRetentionSummary(cards);
    expect(summary.healthy).toBe(1);
    expect(summary.critical).toBeGreaterThanOrEqual(2);
  });

  it("total of all categories equals card count", () => {
    const cards = [
      { stability: 50, daysSinceReview: 0 },
      { stability: 5, daysSinceReview: 10 },
      { stability: 1, daysSinceReview: 50 },
      { stability: 0, daysSinceReview: 0 },
      { stability: 20, daysSinceReview: 5 },
    ];
    const summary = getCardRetentionSummary(cards);
    expect(summary.healthy + summary.atRisk + summary.critical).toBe(cards.length);
  });
});

// ── getSkipCostForecast ────────────────────────────────────────────

describe("getSkipCostForecast", () => {
  it("returns values as percentages (0-100)", () => {
    const cost = getSkipCostForecast(10, 0);
    expect(cost.today).toBeGreaterThanOrEqual(0);
    expect(cost.today).toBeLessThanOrEqual(100);
    expect(cost.skip7).toBeGreaterThanOrEqual(0);
    expect(cost.skip7).toBeLessThanOrEqual(100);
  });

  it("shows decreasing retention the longer you skip", () => {
    const cost = getSkipCostForecast(10, 1);
    expect(cost.today).toBeGreaterThan(cost.skip1);
    expect(cost.skip1).toBeGreaterThan(cost.skip3);
    expect(cost.skip3).toBeGreaterThan(cost.skip7);
  });

  it("returns all zeros when stability is 0", () => {
    const cost = getSkipCostForecast(0, 5);
    expect(cost.today).toBe(0);
    expect(cost.skip1).toBe(0);
    expect(cost.skip3).toBe(0);
    expect(cost.skip7).toBe(0);
  });

  it("matches the FSRS formula for known inputs", () => {
    const stability = 10;
    const daysSinceReview = 2;
    const cost = getSkipCostForecast(stability, daysSinceReview);

    const r = (t: number) =>
      Math.pow(1 + t / (FSRS_DECAY_FACTOR * stability), -1) * 100;

    expect(cost.today).toBeCloseTo(r(2), 10);
    expect(cost.skip1).toBeCloseTo(r(3), 10);
    expect(cost.skip3).toBeCloseTo(r(5), 10);
    expect(cost.skip7).toBeCloseTo(r(9), 10);
  });

  it("today retention is high when daysSinceReview is 0 and stability is high", () => {
    const cost = getSkipCostForecast(100, 0);
    // R(0) = (1 + 0/(9*100))^-1 = 1 -> 100%
    expect(cost.today).toBe(100);
  });

  it("handles large daysSinceReview gracefully", () => {
    const cost = getSkipCostForecast(5, 1000);
    // Should still be a valid number, just very low
    expect(cost.today).toBeGreaterThanOrEqual(0);
    expect(cost.today).toBeLessThan(5); // very decayed
    expect(Number.isFinite(cost.today)).toBe(true);
  });
});
