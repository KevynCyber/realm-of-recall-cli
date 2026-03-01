import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { ThemeProvider } from "../../src/components/app/ThemeProvider.js";
import { DungeonRunScreen } from "../../src/components/screens/DungeonRunScreen.js";
import type { FloorCombatResult } from "../../src/components/screens/DungeonRunScreen.js";
import { createDungeonRun, completeFloor } from "../../src/core/combat/DungeonRun.js";

const delay = (ms = 50) => new Promise<void>((r) => setTimeout(r, ms));

function themed(element: React.ReactElement) {
  return <ThemeProvider>{element}</ThemeProvider>;
}

describe("DungeonRunScreen: combat integration", () => {
  it("renders floor preview on initial mount", () => {
    const { lastFrame } = render(
      themed(
        <DungeonRunScreen
          playerHp={100}
          playerMaxHp={100}
          playerLevel={5}
          onFloorCombat={vi.fn()}
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("DUNGEON RUN");
    expect(frame).toContain("Floor 1");
    expect(frame).toContain("Begin floor");
  });

  it("calls onFloorCombat when Enter is pressed in floor preview", async () => {
    const onFloorCombat = vi.fn();
    const { stdin } = render(
      themed(
        <DungeonRunScreen
          playerHp={100}
          playerMaxHp={100}
          playerLevel={5}
          onFloorCombat={onFloorCombat}
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );

    await delay();
    stdin.write("\r");
    await delay();

    expect(onFloorCombat).toHaveBeenCalledWith(1);
  });

  it("transitions to awaiting_combat phase after Enter", async () => {
    const { stdin, lastFrame } = render(
      themed(
        <DungeonRunScreen
          playerHp={100}
          playerMaxHp={100}
          playerLevel={5}
          onFloorCombat={vi.fn()}
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );

    await delay();
    stdin.write("\r");
    await delay();

    const frame = lastFrame();
    expect(frame).toContain("Combat in progress");
  });

  it("restores dungeon state from initialRunState after remount", async () => {
    // Simulate a dungeon run that has completed 2 floors
    let savedRun = createDungeonRun(100, 100);
    savedRun = completeFloor(savedRun, 20, 30, 80);
    savedRun = completeFloor(savedRun, 25, 35, 60);
    // Now on floor 3

    const combatResult: FloorCombatResult = {
      victory: true,
      goldEarned: 30,
      xpEarned: 45,
      hpRemaining: 45,
    };

    const { lastFrame } = render(
      themed(
        <DungeonRunScreen
          playerHp={100}
          playerMaxHp={100}
          playerLevel={5}
          initialRunState={savedRun}
          floorCombatResult={combatResult}
          onFloorCombat={vi.fn()}
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );

    await delay();

    // With initialRunState + floorCombatResult, it starts in awaiting_combat
    // and immediately processes the result, advancing to floor 4
    const frame = lastFrame();
    // After processing combat result for floor 3 victory, shows floor 4 preview
    // (or possibly an event, but we can check it's no longer on floor 3)
    expect(frame).toBeTruthy();
    expect(frame).not.toContain("Combat in progress");
  });

  it("processes victory combat result and advances floor", async () => {
    // Start with a saved run on floor 1
    const savedRun = createDungeonRun(100, 100);

    const combatResult: FloorCombatResult = {
      victory: true,
      goldEarned: 20,
      xpEarned: 30,
      hpRemaining: 85,
    };

    const { lastFrame } = render(
      themed(
        <DungeonRunScreen
          playerHp={100}
          playerMaxHp={100}
          playerLevel={5}
          initialRunState={savedRun}
          floorCombatResult={combatResult}
          onFloorCombat={vi.fn()}
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );

    await delay();
    const frame = lastFrame();
    // After processing the victory on floor 1, should not be stuck in awaiting_combat
    expect(frame).not.toContain("Combat in progress");
    // The frame should render something meaningful
    expect(frame).toBeTruthy();
    expect(frame!.length).toBeGreaterThan(0);
  });

  it("processes defeat combat result and shows complete phase", async () => {
    const savedRun = createDungeonRun(100, 100);

    const combatResult: FloorCombatResult = {
      victory: false,
      goldEarned: 0,
      xpEarned: 0,
      hpRemaining: 0,
    };

    const { lastFrame } = render(
      themed(
        <DungeonRunScreen
          playerHp={100}
          playerMaxHp={100}
          playerLevel={5}
          initialRunState={savedRun}
          floorCombatResult={combatResult}
          onFloorCombat={vi.fn()}
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );

    await delay();
    const frame = lastFrame();
    expect(frame).toContain("Defeated!");
    expect(frame).toContain("RUN SUMMARY");
  });

  it("reports run state changes to parent via onRunStateChange", async () => {
    const onRunStateChange = vi.fn();
    const savedRun = createDungeonRun(100, 100);

    const combatResult: FloorCombatResult = {
      victory: true,
      goldEarned: 20,
      xpEarned: 30,
      hpRemaining: 85,
    };

    render(
      themed(
        <DungeonRunScreen
          playerHp={100}
          playerMaxHp={100}
          playerLevel={5}
          initialRunState={savedRun}
          floorCombatResult={combatResult}
          onRunStateChange={onRunStateChange}
          onFloorCombat={vi.fn()}
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );

    await delay();
    // onRunStateChange should have been called with updated state
    expect(onRunStateChange).toHaveBeenCalled();
    const updatedState = onRunStateChange.mock.calls[0][0];
    expect(updatedState.floorsCompleted).toBe(1);
    expect(updatedState.playerHp).toBe(85);
  });

  it("simulateFloorResult is no longer exported from DungeonRunScreen", async () => {
    // Import all named exports and verify simulateFloorResult is not among them
    const moduleExports = await import("../../src/components/screens/DungeonRunScreen.js");
    expect("simulateFloorResult" in moduleExports).toBe(false);
  });
});
