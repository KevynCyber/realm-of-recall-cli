import { describe, it, expect } from "vitest";
import {
  getBossPhases,
  getCurrentPhase,
  hasPhaseChanged,
  isBossEnemy,
  PHASE_1_THRESHOLD,
  PHASE_2_THRESHOLD,
  PHASE_3_THRESHOLD,
  type BossPhase,
} from "../../../src/core/combat/BossPhases.js";

describe("getBossPhases", () => {
  it("returns exactly 3 phases", () => {
    const phases = getBossPhases("Dragon");
    expect(phases).toHaveLength(3);
  });

  it("phases are ordered from highest to lowest threshold", () => {
    const phases = getBossPhases("Dragon");
    expect(phases[0].hpThreshold).toBe(PHASE_1_THRESHOLD);
    expect(phases[1].hpThreshold).toBe(PHASE_2_THRESHOLD);
    expect(phases[2].hpThreshold).toBe(PHASE_3_THRESHOLD);
  });

  it("includes the enemy name in descriptions", () => {
    const phases = getBossPhases("Lich");
    for (const phase of phases) {
      expect(phase.description).toContain("Lich");
    }
  });

  it("phase 1 Awakening has normal multipliers and hints enabled", () => {
    const phase = getBossPhases("Dragon")[0];
    expect(phase.name).toBe("Awakening");
    expect(phase.damageMultiplier).toBe(1.0);
    expect(phase.xpMultiplier).toBe(1.0);
    expect(phase.hintsDisabled).toBe(false);
    expect(phase.timerReduction).toBe(0);
  });

  it("phase 2 Fury has 1.5x damage, 1.25x XP, hints disabled", () => {
    const phase = getBossPhases("Dragon")[1];
    expect(phase.name).toBe("Fury");
    expect(phase.damageMultiplier).toBe(1.5);
    expect(phase.xpMultiplier).toBe(1.25);
    expect(phase.hintsDisabled).toBe(true);
    expect(phase.timerReduction).toBe(0);
  });

  it("phase 3 Enrage has 2.0x damage, 2.0x XP, hints disabled, 5s timer reduction", () => {
    const phase = getBossPhases("Dragon")[2];
    expect(phase.name).toBe("Enrage");
    expect(phase.damageMultiplier).toBe(2.0);
    expect(phase.xpMultiplier).toBe(2.0);
    expect(phase.hintsDisabled).toBe(true);
    expect(phase.timerReduction).toBe(5);
  });
});

describe("getCurrentPhase", () => {
  const phases = getBossPhases("Dragon");

  it("returns Awakening at full HP (1.0)", () => {
    const phase = getCurrentPhase(phases, 1.0);
    expect(phase.name).toBe("Awakening");
  });

  it("returns Awakening at 80% HP", () => {
    const phase = getCurrentPhase(phases, 0.8);
    expect(phase.name).toBe("Awakening");
  });

  it("returns Fury at 59% HP", () => {
    const phase = getCurrentPhase(phases, 0.59);
    expect(phase.name).toBe("Fury");
  });

  it("returns Fury at 31% HP", () => {
    const phase = getCurrentPhase(phases, 0.31);
    expect(phase.name).toBe("Fury");
  });

  it("returns Enrage at 29% HP", () => {
    const phase = getCurrentPhase(phases, 0.29);
    expect(phase.name).toBe("Enrage");
  });

  it("returns Enrage at 0% HP", () => {
    const phase = getCurrentPhase(phases, 0);
    expect(phase.name).toBe("Enrage");
  });

  it("returns Enrage at 1% HP", () => {
    const phase = getCurrentPhase(phases, 0.01);
    expect(phase.name).toBe("Enrage");
  });

  // Exact boundaries
  it("returns Awakening at exactly 0.6 (threshold boundary, not below it)", () => {
    const phase = getCurrentPhase(phases, 0.6);
    expect(phase.name).toBe("Awakening");
  });

  it("returns Fury at exactly 0.3 (threshold boundary, not below it)", () => {
    const phase = getCurrentPhase(phases, 0.3);
    expect(phase.name).toBe("Fury");
  });
});

describe("hasPhaseChanged", () => {
  const phases = getBossPhases("Dragon");

  it("detects transition from Awakening to Fury", () => {
    const result = hasPhaseChanged(phases, 0.65, 0.55);
    expect(result.changed).toBe(true);
    expect(result.newPhase).not.toBeNull();
    expect(result.newPhase!.name).toBe("Fury");
  });

  it("detects transition from Fury to Enrage", () => {
    const result = hasPhaseChanged(phases, 0.35, 0.25);
    expect(result.changed).toBe(true);
    expect(result.newPhase!.name).toBe("Enrage");
  });

  it("detects transition skipping Fury (Awakening -> Enrage)", () => {
    const result = hasPhaseChanged(phases, 0.7, 0.1);
    expect(result.changed).toBe(true);
    expect(result.newPhase!.name).toBe("Enrage");
  });

  it("returns no change when staying in Awakening", () => {
    const result = hasPhaseChanged(phases, 0.9, 0.7);
    expect(result.changed).toBe(false);
    expect(result.newPhase).toBeNull();
  });

  it("returns no change when staying in Fury", () => {
    const result = hasPhaseChanged(phases, 0.5, 0.35);
    expect(result.changed).toBe(false);
    expect(result.newPhase).toBeNull();
  });

  it("returns no change when staying in Enrage", () => {
    const result = hasPhaseChanged(phases, 0.2, 0.05);
    expect(result.changed).toBe(false);
    expect(result.newPhase).toBeNull();
  });

  it("detects transition at exact 0.6 boundary crossing", () => {
    // previousHpPercent = 0.6 is Awakening, currentHpPercent = 0.59 is Fury
    const result = hasPhaseChanged(phases, 0.6, 0.59);
    expect(result.changed).toBe(true);
    expect(result.newPhase!.name).toBe("Fury");
  });

  it("detects transition at exact 0.3 boundary crossing", () => {
    // previousHpPercent = 0.3 is Fury, currentHpPercent = 0.29 is Enrage
    const result = hasPhaseChanged(phases, 0.3, 0.29);
    expect(result.changed).toBe(true);
    expect(result.newPhase!.name).toBe("Enrage");
  });

  it("returns no change when both snapshots are at the same boundary", () => {
    const result = hasPhaseChanged(phases, 0.6, 0.6);
    expect(result.changed).toBe(false);
    expect(result.newPhase).toBeNull();
  });
});

describe("isBossEnemy", () => {
  it("returns true for boss tier", () => {
    expect(isBossEnemy("boss")).toBe(true);
  });

  it("returns true for elite tier", () => {
    expect(isBossEnemy("elite")).toBe(true);
  });

  it("returns false for common tier", () => {
    expect(isBossEnemy("common")).toBe(false);
  });

  it("returns false for minion tier", () => {
    expect(isBossEnemy("minion")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isBossEnemy("")).toBe(false);
  });

  it("returns false for arbitrary string", () => {
    expect(isBossEnemy("legendary")).toBe(false);
  });
});

describe("constants", () => {
  it("PHASE_1_THRESHOLD is 1.0", () => {
    expect(PHASE_1_THRESHOLD).toBe(1.0);
  });

  it("PHASE_2_THRESHOLD is 0.6", () => {
    expect(PHASE_2_THRESHOLD).toBe(0.6);
  });

  it("PHASE_3_THRESHOLD is 0.3", () => {
    expect(PHASE_3_THRESHOLD).toBe(0.3);
  });
});
