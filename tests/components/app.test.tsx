import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import {
  ThemeProvider,
  useGameTheme,
  DEFAULT_THEME,
} from "../../src/components/app/ThemeProvider.js";
import { Header } from "../../src/components/app/Header.js";
import { StatusBar } from "../../src/components/app/StatusBar.js";
import { PlayerClass } from "../../src/types/player.js";
import type { Player } from "../../src/types/player.js";
import { Text } from "ink";

function themed(element: React.ReactElement) {
  return <ThemeProvider>{element}</ThemeProvider>;
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: "TestHero",
    class: PlayerClass.Scholar,
    level: 5,
    xp: 200,
    hp: 80,
    maxHp: 100,
    attack: 12,
    defense: 6,
    gold: 340,
    streakDays: 7,
    longestStreak: 14,
    lastReviewDate: "2026-02-28",
    shieldCount: 1,
    totalReviews: 100,
    totalCorrect: 85,
    combatWins: 20,
    combatLosses: 5,
    wisdomXp: 0,
    ascensionLevel: 0,
    skillPoints: 0,
    dailyChallengeSeed: null,
    dailyChallengeCompleted: false,
    dailyChallengeScore: 0,
    dailyChallengeDate: null,
    desiredRetention: 0.9,
    maxNewCardsPerDay: 20,
    createdAt: "2026-02-01",
    ...overrides,
  };
}

describe("ThemeProvider", () => {
  it("provides the default theme via context", () => {
    function ThemeConsumer() {
      const theme = useGameTheme();
      return <Text>{theme.colors.damage}</Text>;
    }
    const { lastFrame } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(lastFrame()).toContain(DEFAULT_THEME.colors.damage);
  });

  it("exports a complete theme with all color keys", () => {
    expect(DEFAULT_THEME.colors.damage).toBeTruthy();
    expect(DEFAULT_THEME.colors.healing).toBeTruthy();
    expect(DEFAULT_THEME.colors.xp).toBeTruthy();
    expect(DEFAULT_THEME.colors.gold).toBeTruthy();
    expect(DEFAULT_THEME.colors.mana).toBeTruthy();
    expect(DEFAULT_THEME.colors.rare).toBeTruthy();
    expect(DEFAULT_THEME.colors.epic).toBeTruthy();
    expect(DEFAULT_THEME.colors.streakFire).toBeTruthy();
    expect(DEFAULT_THEME.colors.muted).toBeTruthy();
    expect(DEFAULT_THEME.colors.success).toBeTruthy();
    expect(DEFAULT_THEME.colors.warning).toBeTruthy();
    expect(DEFAULT_THEME.colors.error).toBeTruthy();
  });

  it("exports rarity colors for all tiers", () => {
    expect(DEFAULT_THEME.rarityColors.common).toBeTruthy();
    expect(DEFAULT_THEME.rarityColors.uncommon).toBeTruthy();
    expect(DEFAULT_THEME.rarityColors.rare).toBeTruthy();
    expect(DEFAULT_THEME.rarityColors.epic).toBeTruthy();
  });
});

describe("Header", () => {
  it("renders the game title", () => {
    const { lastFrame } = render(
      themed(
        <Header playerName="Hero" streakDays={0} dayCount={1} streakAtRisk={false} />,
      ),
    );
    expect(lastFrame()).toContain("Realm of Recall");
  });

  it("renders the day count", () => {
    const { lastFrame } = render(
      themed(
        <Header playerName="Hero" streakDays={0} dayCount={14} streakAtRisk={false} />,
      ),
    );
    expect(lastFrame()).toContain("Day 14");
  });

  it("renders streak count when > 0", () => {
    const { lastFrame } = render(
      themed(
        <Header playerName="Hero" streakDays={7} dayCount={1} streakAtRisk={false} />,
      ),
    );
    expect(lastFrame()).toContain("7 day streak");
  });

  it("renders No streak when streakDays is 0", () => {
    const { lastFrame } = render(
      themed(
        <Header playerName="Hero" streakDays={0} dayCount={1} streakAtRisk={false} />,
      ),
    );
    expect(lastFrame()).toContain("No streak");
  });
});

describe("StatusBar", () => {
  it("renders player level and class", () => {
    const player = makePlayer({ level: 5, class: PlayerClass.Scholar });
    const { lastFrame } = render(themed(<StatusBar player={player} cardsDue={10} />));
    expect(lastFrame()).toContain("Lv.5");
    expect(lastFrame()).toContain("scholar");
  });

  it("renders HP values", () => {
    const player = makePlayer({ hp: 80, maxHp: 100 });
    const { lastFrame } = render(themed(<StatusBar player={player} cardsDue={0} />));
    expect(lastFrame()).toContain("80/100");
  });

  it("renders XP values", () => {
    const player = makePlayer({ level: 1, xp: 50 });
    const { lastFrame } = render(themed(<StatusBar player={player} cardsDue={0} />));
    expect(lastFrame()).toContain("XP 50/");
  });

  it("renders gold amount", () => {
    const player = makePlayer({ gold: 500 });
    const { lastFrame } = render(themed(<StatusBar player={player} cardsDue={0} />));
    expect(lastFrame()).toContain("Gold: 500");
  });

  it("renders cards due count", () => {
    const player = makePlayer();
    const { lastFrame } = render(themed(<StatusBar player={player} cardsDue={15} />));
    expect(lastFrame()).toContain("Due: 15");
  });

  it("renders HP bar characters", () => {
    const player = makePlayer({ hp: 50, maxHp: 100 });
    const { lastFrame } = render(themed(<StatusBar player={player} cardsDue={0} />));
    const frame = lastFrame();
    expect(frame).toContain("█");
    expect(frame).toContain("░");
  });
});
