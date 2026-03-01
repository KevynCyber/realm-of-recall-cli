import { describe, it, expect } from "vitest";
import {
  MODE_WEIGHTS,
  selectMode,
  getModeDamageMultiplier,
} from "../../src/core/review/ModeSelector.js";
import { RetrievalMode } from "../../src/types/index.js";

describe("selectMode", () => {
  it("new cards always get Standard", () => {
    for (let i = 0; i < 100; i++) {
      const result = selectMode("new", [], [], Math.random);
      expect(result).toBe(RetrievalMode.Standard);
    }
  });

  it("relearning cards always get Standard", () => {
    for (let i = 0; i < 100; i++) {
      const result = selectMode("relearning", [], [], Math.random);
      expect(result).toBe(RetrievalMode.Standard);
    }
  });

  it("learning cards only get Standard, Reversed, or Generate", () => {
    const allowed = new Set([RetrievalMode.Standard, RetrievalMode.Reversed, RetrievalMode.Generate]);
    for (let i = 0; i < 100; i++) {
      const result = selectMode("learning", [], [], Math.random);
      expect(allowed.has(result)).toBe(true);
    }
  });

  it("recency penalty reduces weight for recently used modes", () => {
    // With Standard appearing 5 times in recentModesForCard, its weight
    // should be dramatically reduced. Standard baseWeight = 40, penalty = 0.3.
    // After 5 occurrences: 40 * (0.7)^5 ≈ 6.72
    // Other modes keep their base weights (25, 20, 15) summing to 60.
    // So Standard should appear far less than its default ~40% share.

    let standardCount = 0;
    const runs = 10000;
    const recentModes = Array(5).fill(RetrievalMode.Standard);

    for (let i = 0; i < runs; i++) {
      const result = selectMode("review", recentModes, [], Math.random);
      if (result === RetrievalMode.Standard) standardCount++;
    }

    // Without penalty Standard would be ~40%. With penalty it should be ~10%.
    // Allow generous margin but confirm it is well below 25%.
    expect(standardCount / runs).toBeLessThan(0.25);
  });

  it("session variety — excludes mode when last 3 sessionModes are identical", () => {
    const sessionModes = [
      RetrievalMode.Standard,
      RetrievalMode.Standard,
      RetrievalMode.Standard,
    ];
    for (let i = 0; i < 100; i++) {
      const result = selectMode("review", [], sessionModes, Math.random);
      expect(result).not.toBe(RetrievalMode.Standard);
    }
  });

  it("review cards can get all 5 modes with sufficient trials", () => {
    const seen = new Set<RetrievalMode>();
    for (let i = 0; i < 1000; i++) {
      seen.add(selectMode("review", [], [], Math.random));
    }
    expect(seen.size).toBe(5);
    expect(seen.has(RetrievalMode.Standard)).toBe(true);
    expect(seen.has(RetrievalMode.Reversed)).toBe(true);
    expect(seen.has(RetrievalMode.Teach)).toBe(true);
    expect(seen.has(RetrievalMode.Connect)).toBe(true);
    expect(seen.has(RetrievalMode.Generate)).toBe(true);
  });

  it("deterministic rng selects the expected mode", () => {
    // rng = () => 0 should always pick the first mode in the pool (Standard)
    expect(selectMode("review", [], [], () => 0)).toBe(RetrievalMode.Standard);

    // rng = () => 0.999... should pick the last mode (Generate, now last in the pool)
    expect(selectMode("review", [], [], () => 0.9999)).toBe(RetrievalMode.Generate);
  });
});

describe("getModeDamageMultiplier", () => {
  it("Standard → 1.0", () => {
    expect(getModeDamageMultiplier(RetrievalMode.Standard)).toBe(1.0);
  });

  it("Reversed → 1.1", () => {
    expect(getModeDamageMultiplier(RetrievalMode.Reversed)).toBe(1.1);
  });

  it("Teach → 1.5", () => {
    expect(getModeDamageMultiplier(RetrievalMode.Teach)).toBe(1.5);
  });

  it("Connect → 1.2", () => {
    expect(getModeDamageMultiplier(RetrievalMode.Connect)).toBe(1.2);
  });

  it("Generate → 1.3", () => {
    expect(getModeDamageMultiplier(RetrievalMode.Generate)).toBe(1.3);
  });
});

describe("MODE_WEIGHTS", () => {
  it("contains all five retrieval modes", () => {
    const modes = MODE_WEIGHTS.map((w) => w.mode);
    expect(modes).toContain(RetrievalMode.Standard);
    expect(modes).toContain(RetrievalMode.Reversed);
    expect(modes).toContain(RetrievalMode.Teach);
    expect(modes).toContain(RetrievalMode.Connect);
    expect(modes).toContain(RetrievalMode.Generate);
  });

  it("base weights sum to 100", () => {
    const total = MODE_WEIGHTS.reduce((sum, w) => sum + w.baseWeight, 0);
    expect(total).toBe(100);
  });
});
