import { describe, it, expect } from "vitest";
import { selectMode } from "../../../src/core/review/ModeSelector.js";
import { tryAwardVariant } from "../../../src/core/cards/CardVariants.js";
import {
  createDungeonRun,
  getCurrentFloorConfig,
  getFloorConfigs,
  completeFloor,
} from "../../../src/core/combat/DungeonRun.js";
import { RetrievalMode } from "../../../src/types/index.js";

// ─── Mode gating ───

describe("selectMode — meta-progression mode gating", () => {
  it("with no unlock keys, only Standard is available for review cards", () => {
    const emptyKeys = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const mode = selectMode("review", [], [], Math.random, emptyKeys);
      expect(mode).toBe(RetrievalMode.Standard);
    }
  });

  it("with reversed_mode unlocked, review cards can get Standard or Reversed", () => {
    const keys = new Set(["reversed_mode"]);
    const seen = new Set<RetrievalMode>();
    for (let i = 0; i < 500; i++) {
      seen.add(selectMode("review", [], [], Math.random, keys));
    }
    expect(seen.has(RetrievalMode.Standard)).toBe(true);
    expect(seen.has(RetrievalMode.Reversed)).toBe(true);
    expect(seen.has(RetrievalMode.Teach)).toBe(false);
    expect(seen.has(RetrievalMode.Connect)).toBe(false);
  });

  it("with all mode keys unlocked, review cards can get all 5 modes", () => {
    const keys = new Set(["reversed_mode", "teach_mode", "connect_mode", "generate_mode"]);
    const seen = new Set<RetrievalMode>();
    for (let i = 0; i < 1000; i++) {
      seen.add(selectMode("review", [], [], Math.random, keys));
    }
    expect(seen.size).toBe(5);
  });

  it("without unlockedKeys parameter (undefined), all modes are available (backward compat)", () => {
    const seen = new Set<RetrievalMode>();
    for (let i = 0; i < 1000; i++) {
      seen.add(selectMode("review", [], [], Math.random));
    }
    expect(seen.size).toBe(5);
  });

  it("new cards always get Standard regardless of unlock state", () => {
    const keys = new Set(["reversed_mode", "teach_mode", "connect_mode"]);
    for (let i = 0; i < 100; i++) {
      expect(selectMode("new", [], [], Math.random, keys)).toBe(RetrievalMode.Standard);
    }
  });

  it("learning cards only get Standard when reversed is not unlocked", () => {
    const keys = new Set(["teach_mode"]); // no reversed_mode
    for (let i = 0; i < 100; i++) {
      expect(selectMode("learning", [], [], Math.random, keys)).toBe(RetrievalMode.Standard);
    }
  });
});

// ─── Prismatic variant gating ───

describe("tryAwardVariant — prismatic gating", () => {
  it("does not award prismatic when isPrismaticUnlocked is false", () => {
    // Roll value 0 would normally give prismatic
    const result = tryAwardVariant(10, null, () => 0, false);
    // With prismatic filtered out, roll 0 should hit golden instead
    expect(result).not.toBe("prismatic");
    expect(result).toBe("golden");
  });

  it("awards prismatic when isPrismaticUnlocked is true", () => {
    const result = tryAwardVariant(10, null, () => 0, true);
    expect(result).toBe("prismatic");
  });

  it("awards prismatic by default (backward compat)", () => {
    const result = tryAwardVariant(10, null, () => 0);
    expect(result).toBe("prismatic");
  });

  it("golden and foil drops still work when prismatic is locked", () => {
    // golden: roll just above 0 should hit golden (rate 0.009)
    const golden = tryAwardVariant(10, null, () => 0.001, false);
    expect(golden).toBe("golden");

    // foil: roll in [0.009, 0.049) should hit foil
    const foil = tryAwardVariant(10, null, () => 0.02, false);
    expect(foil).toBe("foil");
  });

  it("no drop for high roll even when prismatic is locked", () => {
    const result = tryAwardVariant(10, null, () => 0.9, false);
    expect(result).toBeNull();
  });
});

// ─── Extended dungeon gating ───

describe("DungeonRun — extended dungeon floors", () => {
  it("base dungeon has 5 maxFloors", () => {
    const run = createDungeonRun(100, 100);
    expect(run.maxFloors).toBe(5);
  });

  it("extended dungeon has 8 maxFloors", () => {
    const run = createDungeonRun(100, 100, true);
    expect(run.maxFloors).toBe(8);
  });

  it("getFloorConfigs returns 5 configs without extension", () => {
    const configs = getFloorConfigs(false);
    expect(configs).toHaveLength(5);
    expect(configs[4].floor).toBe(5);
    expect(configs[4].isBoss).toBe(true);
  });

  it("getFloorConfigs returns 8 configs with extension", () => {
    const configs = getFloorConfigs(true);
    expect(configs).toHaveLength(8);
  });

  it("extended floor 6 has 3.5x HP multiplier", () => {
    const configs = getFloorConfigs(true);
    const floor6 = configs.find((c) => c.floor === 6)!;
    expect(floor6.enemyHpMultiplier).toBe(3.5);
    expect(floor6.isBoss).toBe(false);
  });

  it("extended floor 7 has 4.0x HP multiplier", () => {
    const configs = getFloorConfigs(true);
    const floor7 = configs.find((c) => c.floor === 7)!;
    expect(floor7.enemyHpMultiplier).toBe(4.0);
    expect(floor7.isBoss).toBe(false);
  });

  it("extended floor 8 has 5.0x HP multiplier and is boss", () => {
    const configs = getFloorConfigs(true);
    const floor8 = configs.find((c) => c.floor === 8)!;
    expect(floor8.enemyHpMultiplier).toBe(5.0);
    expect(floor8.isBoss).toBe(true);
  });

  it("floor 5 is NOT boss when extended (boss moves to floor 8)", () => {
    const configs = getFloorConfigs(true);
    const floor5 = configs.find((c) => c.floor === 5)!;
    expect(floor5.isBoss).toBe(false);
  });

  it("getCurrentFloorConfig uses extended configs when flag is true", () => {
    let run = createDungeonRun(100, 100, true);
    // Advance to floor 6
    for (let i = 0; i < 5; i++) {
      run = completeFloor(run, 10, 10, 90);
    }
    expect(run.currentFloor).toBe(6);
    const config = getCurrentFloorConfig(run, true);
    expect(config.floor).toBe(6);
    expect(config.enemyHpMultiplier).toBe(3.5);
  });

  it("extended run completes after 8 floors", () => {
    let run = createDungeonRun(100, 100, true);
    for (let i = 0; i < 8; i++) {
      run = completeFloor(run, 10, 10, 90);
    }
    expect(run.completed).toBe(true);
    expect(run.floorsCompleted).toBe(8);
  });

  it("standard run completes after 5 floors", () => {
    let run = createDungeonRun(100, 100, false);
    for (let i = 0; i < 5; i++) {
      run = completeFloor(run, 10, 10, 90);
    }
    expect(run.completed).toBe(true);
    expect(run.floorsCompleted).toBe(5);
  });
});
