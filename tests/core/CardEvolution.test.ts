import { describe, it, expect } from "vitest";
import {
  evaluateEvolutionTier,
  getCardHealth,
  getTierDamageMultiplier,
  getTierCritBonus,
  getTierVisual,
  type EvolutionTier,
} from "../../src/core/cards/CardEvolution.js";

describe("evaluateEvolutionTier", () => {
  it("stays at tier 0 with fewer than 3 consecutive correct", () => {
    expect(evaluateEvolutionTier(2, 0, "learning", 5, 0)).toBe(0);
    expect(evaluateEvolutionTier(0, 0, "review", 20, 0)).toBe(0);
    expect(evaluateEvolutionTier(1, 0, "review", 50, 0)).toBe(0);
  });

  it("stays at tier 0 when state is new even with 3 consecutive correct", () => {
    expect(evaluateEvolutionTier(3, 0, "new", 0, 0)).toBe(0);
    expect(evaluateEvolutionTier(5, 0, "new", 50, 0)).toBe(0);
  });

  it("promotes to tier 1 with 3 consecutive correct and state !== new", () => {
    expect(evaluateEvolutionTier(3, 0, "learning", 5, 0)).toBe(1);
    expect(evaluateEvolutionTier(3, 0, "review", 5, 0)).toBe(1);
  });

  it("stays at tier 1 when stability < 10", () => {
    expect(evaluateEvolutionTier(3, 0, "review", 9, 0)).toBe(1);
    expect(evaluateEvolutionTier(5, 0, "review", 9.99, 0)).toBe(1);
  });

  it("promotes to tier 2 with 3 consecutive correct and stability >= 10", () => {
    expect(evaluateEvolutionTier(3, 0, "review", 10, 0)).toBe(2);
    expect(evaluateEvolutionTier(5, 0, "review", 15, 0)).toBe(2);
  });

  it("stays at tier 2 when stability < 30", () => {
    expect(evaluateEvolutionTier(3, 0, "review", 29, 0)).toBe(2);
  });

  it("stays at tier 2 when lapsesSinceTier > 0", () => {
    expect(evaluateEvolutionTier(3, 0, "review", 30, 1)).toBe(2);
    expect(evaluateEvolutionTier(5, 0, "review", 50, 3)).toBe(2);
  });

  it("promotes to tier 3 with stability >= 30 and no lapses since tier", () => {
    expect(evaluateEvolutionTier(3, 0, "review", 30, 0)).toBe(3);
    expect(evaluateEvolutionTier(5, 0, "review", 100, 0)).toBe(3);
  });

  it("never decreases tier", () => {
    // Already at tier 2 but conditions only meet tier 1
    expect(evaluateEvolutionTier(3, 2, "review", 5, 0)).toBe(2);

    // Already at tier 3 but conditions only meet tier 0
    expect(evaluateEvolutionTier(0, 3, "new", 0, 5)).toBe(3);

    // Already at tier 1 but conditions meet tier 0
    expect(evaluateEvolutionTier(1, 1, "review", 0, 0)).toBe(1);

    // Already at tier 3 but conditions only meet tier 2
    expect(evaluateEvolutionTier(3, 3, "review", 15, 1)).toBe(3);
  });

  it("preserves current tier when computed tier equals current tier", () => {
    expect(evaluateEvolutionTier(3, 1, "review", 5, 0)).toBe(1);
    expect(evaluateEvolutionTier(3, 2, "review", 10, 0)).toBe(2);
  });
});

describe("getCardHealth", () => {
  it("returns leech when totalLapses >= 5", () => {
    expect(getCardHealth([], 5)).toBe("leech");
    expect(getCardHealth(["correct", "correct"], 10)).toBe("leech");
    expect(getCardHealth(["wrong", "wrong", "wrong", "wrong", "wrong"], 5)).toBe("leech");
  });

  it("returns struggling when 3+ of last 5 are wrong or timeout", () => {
    expect(getCardHealth(["wrong", "wrong", "wrong"], 2)).toBe("struggling");
    expect(getCardHealth(["timeout", "timeout", "timeout"], 0)).toBe("struggling");
    expect(getCardHealth(["wrong", "timeout", "wrong"], 1)).toBe("struggling");
    expect(getCardHealth(["correct", "wrong", "wrong", "timeout", "correct"], 2)).toBe("struggling");
  });

  it("returns healthy when fewer than 3 of last 5 are wrong/timeout", () => {
    expect(getCardHealth([], 0)).toBe("healthy");
    expect(getCardHealth(["correct", "correct", "correct"], 0)).toBe("healthy");
    expect(getCardHealth(["wrong", "wrong", "correct", "correct", "correct"], 2)).toBe("healthy");
    expect(getCardHealth(["correct", "wrong", "correct", "timeout", "correct"], 1)).toBe("healthy");
  });

  it("only considers the last 5 entries", () => {
    // 6 entries: first one should be ignored
    expect(getCardHealth(["wrong", "correct", "correct", "correct", "correct", "correct"], 0)).toBe("healthy");

    // Many wrong entries but last 5 are correct
    expect(
      getCardHealth(
        ["wrong", "wrong", "wrong", "wrong", "correct", "correct", "correct", "correct", "correct"],
        2,
      ),
    ).toBe("healthy");
  });

  it("leech takes priority over struggling", () => {
    expect(getCardHealth(["wrong", "wrong", "wrong", "wrong", "wrong"], 5)).toBe("leech");
  });
});

describe("getTierDamageMultiplier", () => {
  it("returns 1.0 for tier 0", () => {
    expect(getTierDamageMultiplier(0)).toBe(1.0);
  });

  it("returns 1.25 for tier 1", () => {
    expect(getTierDamageMultiplier(1)).toBe(1.25);
  });

  it("returns 1.5 for tier 2", () => {
    expect(getTierDamageMultiplier(2)).toBe(1.5);
  });

  it("returns 2.0 for tier 3", () => {
    expect(getTierDamageMultiplier(3)).toBe(2.0);
  });
});

describe("getTierCritBonus", () => {
  it("returns 0 for tier 0", () => {
    expect(getTierCritBonus(0)).toBe(0);
  });

  it("returns 0 for tier 1", () => {
    expect(getTierCritBonus(1)).toBe(0);
  });

  it("returns 10 for tier 2", () => {
    expect(getTierCritBonus(2)).toBe(10);
  });

  it("returns 25 for tier 3", () => {
    expect(getTierCritBonus(3)).toBe(25);
  });
});

describe("getTierVisual", () => {
  it("returns round/cyan/0 stars for tier 0", () => {
    expect(getTierVisual(0)).toEqual({
      borderStyle: "round",
      borderColor: "cyan",
      stars: 0,
    });
  });

  it("returns round/cyan/1 star for tier 1", () => {
    expect(getTierVisual(1)).toEqual({
      borderStyle: "round",
      borderColor: "cyan",
      stars: 1,
    });
  });

  it("returns double/yellow/2 stars for tier 2", () => {
    expect(getTierVisual(2)).toEqual({
      borderStyle: "double",
      borderColor: "yellow",
      stars: 2,
    });
  });

  it("returns double/magenta/3 stars for tier 3", () => {
    expect(getTierVisual(3)).toEqual({
      borderStyle: "double",
      borderColor: "magenta",
      stars: 3,
    });
  });
});
