import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { ThemeProvider } from "../../src/components/app/ThemeProvider.js";
import { EncounterPreview } from "../../src/components/combat/EncounterPreview.js";
import type { PreviewData } from "../../src/components/combat/EncounterPreview.js";
import { EnemyTier } from "../../src/types/combat.js";
import type { Enemy } from "../../src/types/combat.js";

const delay = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

function themed(element: React.ReactElement) {
  return <ThemeProvider>{element}</ThemeProvider>;
}

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    name: "Shadow Wolf",
    tier: EnemyTier.Common,
    hp: 80,
    maxHp: 80,
    attack: 12,
    xpReward: 50,
    goldReward: 25,
    ...overrides,
  };
}

function makePreviewData(overrides: Partial<PreviewData> = {}): PreviewData {
  return {
    avgDifficulty: 5,
    deckNames: "Geography",
    xpReward: 50,
    goldReward: 25,
    ...overrides,
  };
}

describe("EncounterPreview", () => {
  it("renders 'Encounter Preview' header", () => {
    const { lastFrame } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={5}
          previewData={makePreviewData()}
          onFight={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("Encounter Preview");
  });

  it("renders enemy name and tier", () => {
    const { lastFrame } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy({ name: "Fire Drake", tier: EnemyTier.Elite })}
          cardCount={5}
          previewData={makePreviewData()}
          onFight={vi.fn()}
        />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("Fire Drake");
    expect(frame).toContain("elite");
  });

  it("renders enemy HP", () => {
    const { lastFrame } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy({ maxHp: 150 })}
          cardCount={5}
          previewData={makePreviewData()}
          onFight={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("150");
  });

  it("renders estimated difficulty label and value", () => {
    const { lastFrame } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={5}
          previewData={makePreviewData({ avgDifficulty: 4.2 })}
          onFight={vi.fn()}
        />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("Medium");
    expect(frame).toContain("4.2");
  });

  it("renders Easy for low difficulty", () => {
    const { lastFrame } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={5}
          previewData={makePreviewData({ avgDifficulty: 2.5 })}
          onFight={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("Easy");
  });

  it("renders Hard for high difficulty", () => {
    const { lastFrame } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={5}
          previewData={makePreviewData({ avgDifficulty: 8.0 })}
          onFight={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("Hard");
  });

  it("renders deck/topic name", () => {
    const { lastFrame } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={5}
          previewData={makePreviewData({ deckNames: "World History" })}
          onFight={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("World History");
  });

  it("renders card count", () => {
    const { lastFrame } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={8}
          previewData={makePreviewData()}
          onFight={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("8");
  });

  it("renders potential XP and gold reward range", () => {
    const { lastFrame } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={5}
          previewData={makePreviewData({ xpReward: 75, goldReward: 40 })}
          onFight={vi.fn()}
        />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("~75 XP");
    expect(frame).toContain("~40 Gold");
  });

  it("renders [Enter] Fight control", () => {
    const { lastFrame } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={5}
          previewData={makePreviewData()}
          onFight={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("[Enter] Fight");
  });

  it("renders [Escape] Retreat control when not a dungeon floor", () => {
    const { lastFrame } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={5}
          previewData={makePreviewData()}
          onFight={vi.fn()}
          onRetreat={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("[Escape] Retreat");
  });

  it("renders 'No turning back!' for dungeon floors instead of Escape option", () => {
    const { lastFrame } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={5}
          previewData={makePreviewData()}
          isDungeonFloor={true}
          onFight={vi.fn()}
          onRetreat={vi.fn()}
        />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("No turning back!");
    expect(frame).not.toContain("[Escape] Retreat");
  });

  it("calls onFight when Enter is pressed", async () => {
    const onFight = vi.fn();
    const { stdin } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={5}
          previewData={makePreviewData()}
          onFight={onFight}
          onRetreat={vi.fn()}
        />,
      ),
    );
    await delay();
    stdin.write("\r");
    expect(onFight).toHaveBeenCalledOnce();
  });

  it("calls onRetreat when Escape is pressed", async () => {
    const onRetreat = vi.fn();
    const { stdin } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={5}
          previewData={makePreviewData()}
          onFight={vi.fn()}
          onRetreat={onRetreat}
        />,
      ),
    );
    await delay();
    stdin.write("\x1B");
    expect(onRetreat).toHaveBeenCalledOnce();
  });

  it("does not call onRetreat on Escape when isDungeonFloor is true", async () => {
    const onRetreat = vi.fn();
    const { stdin } = render(
      themed(
        <EncounterPreview
          enemy={makeEnemy()}
          cardCount={5}
          previewData={makePreviewData()}
          isDungeonFloor={true}
          onFight={vi.fn()}
          onRetreat={onRetreat}
        />,
      ),
    );
    await delay();
    stdin.write("\x1B");
    expect(onRetreat).not.toHaveBeenCalled();
  });
});
