import { describe, it, expect } from "vitest";
import {
  getDailySeed,
  generateDailyChallenge,
  scoreDailyChallenge,
} from "../../../src/core/combat/DailyChallenge.js";
import { CardType, EnemyTier } from "../../../src/types/index.js";
import type { Card } from "../../../src/types/index.js";

function makeCard(id: string): Card {
  return {
    id,
    front: `Front ${id}`,
    back: `Back ${id}`,
    acceptableAnswers: [`Back ${id}`],
    type: CardType.Basic,
    deckId: "deck1",
  };
}

describe("getDailySeed", () => {
  it("returns YYYY-MM-DD format", () => {
    const seed = getDailySeed(new Date(2024, 0, 15)); // Jan 15, 2024
    expect(seed).toBe("2024-01-15");
  });

  it("pads single-digit month and day", () => {
    const seed = getDailySeed(new Date(2024, 2, 5)); // Mar 5, 2024
    expect(seed).toBe("2024-03-05");
  });

  it("returns same seed for same date", () => {
    const d1 = getDailySeed(new Date(2024, 5, 10));
    const d2 = getDailySeed(new Date(2024, 5, 10));
    expect(d1).toBe(d2);
  });

  it("returns different seeds for different dates", () => {
    const d1 = getDailySeed(new Date(2024, 5, 10));
    const d2 = getDailySeed(new Date(2024, 5, 11));
    expect(d1).not.toBe(d2);
  });

  it("defaults to today when no date provided", () => {
    const seed = getDailySeed();
    expect(seed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("generateDailyChallenge", () => {
  const cards = Array.from({ length: 20 }, (_, i) => makeCard(`card${i}`));

  it("generates an enemy with Elite tier", () => {
    const config = generateDailyChallenge("2024-01-15", cards, 5);
    expect(config.enemy.tier).toBe(EnemyTier.Elite);
  });

  it("enemy stats scale with player level", () => {
    const low = generateDailyChallenge("2024-01-15", cards, 1);
    const high = generateDailyChallenge("2024-01-15", cards, 10);
    expect(high.enemy.hp).toBeGreaterThan(low.enemy.hp);
    expect(high.enemy.attack).toBeGreaterThan(low.enemy.attack);
  });

  it("selects up to 10 cards", () => {
    const config = generateDailyChallenge("2024-01-15", cards, 5);
    expect(config.cardIds).toHaveLength(10);
  });

  it("selects fewer cards if not enough available", () => {
    const fewCards = [makeCard("a"), makeCard("b"), makeCard("c")];
    const config = generateDailyChallenge("2024-01-15", fewCards, 5);
    expect(config.cardIds).toHaveLength(3);
  });

  it("has 2x gold multiplier and 1.5x XP multiplier", () => {
    const config = generateDailyChallenge("2024-01-15", cards, 5);
    expect(config.bonusGoldMultiplier).toBe(2.0);
    expect(config.bonusXpMultiplier).toBe(1.5);
  });

  it("is deterministic — same seed produces same result", () => {
    const c1 = generateDailyChallenge("2024-01-15", cards, 5);
    const c2 = generateDailyChallenge("2024-01-15", cards, 5);
    expect(c1.enemy.name).toBe(c2.enemy.name);
    expect(c1.enemy.hp).toBe(c2.enemy.hp);
    expect(c1.cardIds).toEqual(c2.cardIds);
  });

  it("different seeds produce different results", () => {
    const c1 = generateDailyChallenge("2024-01-15", cards, 5);
    const c2 = generateDailyChallenge("2024-01-16", cards, 5);
    // Very unlikely both have same enemy name AND same card order
    const same = c1.enemy.name === c2.enemy.name && JSON.stringify(c1.cardIds) === JSON.stringify(c2.cardIds);
    expect(same).toBe(false);
  });

  it("enemy has valid name from predefined list", () => {
    const config = generateDailyChallenge("2024-06-20", cards, 5);
    expect(config.enemy.name).toBeTruthy();
    expect(typeof config.enemy.name).toBe("string");
  });

  it("handles empty card array", () => {
    const config = generateDailyChallenge("2024-01-15", [], 5);
    expect(config.cardIds).toEqual([]);
    expect(config.enemy).toBeDefined();
  });
});

describe("scoreDailyChallenge", () => {
  it("returns 0 for no cards and no damage", () => {
    const score = scoreDailyChallenge(0, 0, 30000, 0);
    expect(score.total).toBe(0);
  });

  it("accuracy score: 500 for perfect accuracy", () => {
    const score = scoreDailyChallenge(10, 10, 0, 0);
    expect(score.accuracyScore).toBe(500);
  });

  it("accuracy score: 250 for 50% accuracy", () => {
    const score = scoreDailyChallenge(5, 10, 30000, 0);
    expect(score.accuracyScore).toBe(250);
  });

  it("speed score: 300 for instant response (0ms)", () => {
    const score = scoreDailyChallenge(0, 0, 0, 0);
    expect(score.speedScore).toBe(300);
  });

  it("speed score: 0 for 30s+ response time", () => {
    const score = scoreDailyChallenge(0, 0, 30000, 0);
    expect(score.speedScore).toBe(0);
  });

  it("speed score: 150 for 15s response time (50% of max)", () => {
    const score = scoreDailyChallenge(0, 0, 15000, 0);
    expect(score.speedScore).toBe(150);
  });

  it("damage score caps at 200", () => {
    const score = scoreDailyChallenge(0, 0, 30000, 200);
    expect(score.damageScore).toBe(200);
  });

  it("damage score: 2x damage dealt", () => {
    const score = scoreDailyChallenge(0, 0, 30000, 50);
    expect(score.damageScore).toBe(100);
  });

  it("total is sum of all scores", () => {
    const score = scoreDailyChallenge(10, 10, 0, 50);
    expect(score.total).toBe(score.accuracyScore + score.speedScore + score.damageScore);
  });

  it("maximum possible score is 1000", () => {
    const score = scoreDailyChallenge(10, 10, 0, 200);
    expect(score.total).toBe(1000);
  });
});
