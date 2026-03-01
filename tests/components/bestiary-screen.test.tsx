import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { ThemeProvider } from "../../src/components/app/ThemeProvider.js";
import { BestiaryScreen } from "../../src/components/screens/BestiaryScreen.js";
import type { CollectionDeckStats } from "../../src/components/screens/BestiaryScreen.js";
import type { EnemyEncounter } from "../../src/data/repositories/EnemyRepository.js";

const delay = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

function themed(element: React.ReactElement) {
  return <ThemeProvider>{element}</ThemeProvider>;
}

const sampleEncounters: EnemyEncounter[] = [
  {
    id: 1,
    enemyName: "Slime",
    enemyTier: 0,
    timesDefeated: 5,
    firstDefeatedAt: "2026-02-15 10:00:00",
    lastDefeatedAt: "2026-02-28 12:00:00",
  },
  {
    id: 2,
    enemyName: "Goblin",
    enemyTier: 1,
    timesDefeated: 3,
    firstDefeatedAt: "2026-02-20 14:00:00",
    lastDefeatedAt: "2026-02-27 09:00:00",
  },
  {
    id: 3,
    enemyName: "Dragon",
    enemyTier: 3,
    timesDefeated: 1,
    firstDefeatedAt: "2026-02-28 18:00:00",
    lastDefeatedAt: "2026-02-28 18:00:00",
  },
];

const sampleCollection: CollectionDeckStats[] = [
  { name: "Geography", total: 50, mastered: 30 },
  { name: "Math", total: 20, mastered: 5 },
];

describe("BestiaryScreen", () => {
  describe("Enemies tab", () => {
    it("renders Bestiary header", () => {
      const { lastFrame } = render(
        themed(
          <BestiaryScreen
            encounters={sampleEncounters}
            collectionStats={sampleCollection}
            onBack={vi.fn()}
          />,
        ),
      );
      expect(lastFrame()).toContain("Bestiary");
    });

    it("renders tier headers", () => {
      const { lastFrame } = render(
        themed(
          <BestiaryScreen
            encounters={sampleEncounters}
            collectionStats={sampleCollection}
            onBack={vi.fn()}
          />,
        ),
      );
      const frame = lastFrame();
      expect(frame).toContain("-- Minion --");
      expect(frame).toContain("-- Common --");
      expect(frame).toContain("-- Elite --");
      expect(frame).toContain("-- Boss --");
    });

    it("renders encountered enemies with names and defeat counts", () => {
      const { lastFrame } = render(
        themed(
          <BestiaryScreen
            encounters={sampleEncounters}
            collectionStats={sampleCollection}
            onBack={vi.fn()}
          />,
        ),
      );
      const frame = lastFrame();
      expect(frame).toContain("Slime");
      expect(frame).toContain("x5");
      expect(frame).toContain("Goblin");
      expect(frame).toContain("x3");
      expect(frame).toContain("Dragon");
      expect(frame).toContain("x1");
    });

    it("renders first encounter date for encountered enemies", () => {
      const { lastFrame } = render(
        themed(
          <BestiaryScreen
            encounters={sampleEncounters}
            collectionStats={sampleCollection}
            onBack={vi.fn()}
          />,
        ),
      );
      const frame = lastFrame();
      expect(frame).toContain("2026-02-15");
    });

    it("renders unencountered enemies as ???", () => {
      const { lastFrame } = render(
        themed(
          <BestiaryScreen
            encounters={sampleEncounters}
            collectionStats={sampleCollection}
            onBack={vi.fn()}
          />,
        ),
      );
      const frame = lastFrame();
      // Bat, Rat, Beetle, Wisp are unencountered minions - shown as ???
      // Count occurrences of ???
      const matches = frame.match(/\?\?\?/g);
      expect(matches).toBeTruthy();
      // Minion pool has 5 names, 1 encountered (Slime) = 4 ???
      // Common pool has 5 names, 1 encountered (Goblin) = 4 ???
      // Elite pool has 5 names, 0 encountered = 5 ???
      // Boss pool has 5 names, 1 encountered (Dragon) = 4 ???
      // Total: 17 ???
      expect(matches!.length).toBe(17);
    });

    it("shows Enemies tab active by default", () => {
      const { lastFrame } = render(
        themed(
          <BestiaryScreen
            encounters={[]}
            collectionStats={[]}
            onBack={vi.fn()}
          />,
        ),
      );
      const frame = lastFrame();
      expect(frame).toContain("Enemies");
    });
  });

  describe("Collection tab", () => {
    it("renders collection stats after switching to Collection tab", async () => {
      const { lastFrame, stdin } = render(
        themed(
          <BestiaryScreen
            encounters={sampleEncounters}
            collectionStats={sampleCollection}
            onBack={vi.fn()}
          />,
        ),
      );
      await delay();
      stdin.write("\t"); // Tab to switch to Collection tab
      await delay();
      const frame = lastFrame();
      expect(frame).toContain("Geography");
      expect(frame).toContain("50 cards");
      expect(frame).toContain("30 mastered");
      expect(frame).toContain("60%");
    });

    it("renders Math deck stats in collection tab", async () => {
      const { lastFrame, stdin } = render(
        themed(
          <BestiaryScreen
            encounters={sampleEncounters}
            collectionStats={sampleCollection}
            onBack={vi.fn()}
          />,
        ),
      );
      await delay();
      stdin.write("\t");
      await delay();
      const frame = lastFrame();
      expect(frame).toContain("Math");
      expect(frame).toContain("20 cards");
      expect(frame).toContain("5 mastered");
      expect(frame).toContain("25%");
    });

    it("renders progress bar", async () => {
      const { lastFrame, stdin } = render(
        themed(
          <BestiaryScreen
            encounters={[]}
            collectionStats={[{ name: "Test", total: 10, mastered: 5 }]}
            onBack={vi.fn()}
          />,
        ),
      );
      await delay();
      stdin.write("\t");
      await delay();
      const frame = lastFrame();
      // 50% of 20 chars = 10 filled, 10 empty
      expect(frame).toContain("[##########----------]");
    });

    it("renders no decks message when collection is empty", async () => {
      const { lastFrame, stdin } = render(
        themed(
          <BestiaryScreen
            encounters={[]}
            collectionStats={[]}
            onBack={vi.fn()}
          />,
        ),
      );
      await delay();
      stdin.write("\t");
      await delay();
      expect(lastFrame()).toContain("No decks imported yet");
    });
  });

  describe("Navigation", () => {
    it("calls onBack when Escape is pressed", async () => {
      const onBack = vi.fn();
      const { stdin } = render(
        themed(
          <BestiaryScreen
            encounters={[]}
            collectionStats={[]}
            onBack={onBack}
          />,
        ),
      );
      await delay();
      stdin.write("\x1B");
      expect(onBack).toHaveBeenCalledOnce();
    });

    it("switches between tabs with Tab key", async () => {
      const { lastFrame, stdin } = render(
        themed(
          <BestiaryScreen
            encounters={sampleEncounters}
            collectionStats={sampleCollection}
            onBack={vi.fn()}
          />,
        ),
      );

      // Initially on Enemies tab - check tier headers are shown
      expect(lastFrame()).toContain("-- Minion --");

      await delay();
      stdin.write("\t"); // Switch to Collection
      await delay();
      expect(lastFrame()).toContain("Geography");

      await delay();
      stdin.write("\t"); // Switch back to Enemies
      await delay();
      expect(lastFrame()).toContain("-- Minion --");
    });

    it("renders navigation hint", () => {
      const { lastFrame } = render(
        themed(
          <BestiaryScreen
            encounters={[]}
            collectionStats={[]}
            onBack={vi.fn()}
          />,
        ),
      );
      const frame = lastFrame();
      expect(frame).toContain("scroll");
      expect(frame).toContain("Tab");
      expect(frame).toContain("Esc");
    });
  });
});
