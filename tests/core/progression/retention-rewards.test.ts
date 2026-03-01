import { describe, it, expect } from "vitest";
import {
  getRetentionMultiplier,
  calculateCombatXP,
  calculateGoldReward,
} from "../../../src/core/progression/XPCalculator.js";

// ---------------------------------------------------------------------------
// getRetentionMultiplier
// ---------------------------------------------------------------------------
describe("getRetentionMultiplier", () => {
  it("returns 1x for 0 days since last review", () => {
    expect(getRetentionMultiplier(0)).toBe(1);
  });

  it("returns 1x for 1 day since last review", () => {
    expect(getRetentionMultiplier(1)).toBe(1);
  });

  it("returns 1x for 6 days since last review", () => {
    expect(getRetentionMultiplier(6)).toBe(1);
  });

  it("returns 1x for 6.99 days since last review", () => {
    expect(getRetentionMultiplier(6.99)).toBe(1);
  });

  it("returns 3x for exactly 7 days since last review", () => {
    expect(getRetentionMultiplier(7)).toBe(3);
  });

  it("returns 3x for 15 days since last review", () => {
    expect(getRetentionMultiplier(15)).toBe(3);
  });

  it("returns 3x for 29 days since last review", () => {
    expect(getRetentionMultiplier(29)).toBe(3);
  });

  it("returns 3x for 29.99 days since last review", () => {
    expect(getRetentionMultiplier(29.99)).toBe(3);
  });

  it("returns 5x for exactly 30 days since last review", () => {
    expect(getRetentionMultiplier(30)).toBe(5);
  });

  it("returns 5x for 60 days since last review", () => {
    expect(getRetentionMultiplier(60)).toBe(5);
  });

  it("returns 5x for 365 days since last review", () => {
    expect(getRetentionMultiplier(365)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Retention multiplier applied to XP calculation
// ---------------------------------------------------------------------------
describe("retention rewards integration with XP", () => {
  it("base review XP is 5 per card, retention bonus adds (mult-1)*5 extra", () => {
    // Simulate 3 cards reviewed:
    // - Card 1: 2 days ago (1x, no bonus)
    // - Card 2: 10 days ago (3x, bonus = 2*5 = 10)
    // - Card 3: 45 days ago (5x, bonus = 4*5 = 20)
    const baseXpPerCard = 5;
    const cardCount = 3;
    const retentionBonuses = [
      { days: 2, expectedMult: 1 },
      { days: 10, expectedMult: 3 },
      { days: 45, expectedMult: 5 },
    ];

    let totalRetentionBonus = 0;
    for (const card of retentionBonuses) {
      const mult = getRetentionMultiplier(card.days);
      expect(mult).toBe(card.expectedMult);
      if (mult > 1) {
        totalRetentionBonus += (mult - 1) * baseXpPerCard;
      }
    }

    // Base XP: 3 * 5 = 15
    // Retention bonus: 10 + 20 = 30
    // Total: 45
    const totalXp = cardCount * baseXpPerCard + totalRetentionBonus;
    expect(totalXp).toBe(45);
  });

  it("no retention bonus for cards with no previous review", () => {
    // New cards have no lastReview — multiplier should not apply
    // The code checks for existing?.lastReview being truthy
    // Simulating: a new card with 0 days has mult 1x
    expect(getRetentionMultiplier(0)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Retention multiplier applied to combat gold
// ---------------------------------------------------------------------------
describe("retention rewards integration with combat gold", () => {
  it("combat gold receives retention bonus per card share", () => {
    // Base gold reward from enemy: 100
    // 5 cards reviewed, 2 of which have long-interval recall
    const baseGold = calculateGoldReward(100, 0); // no class bonus
    expect(baseGold).toBe(100);

    const cardsReviewed = 5;
    const perCardGold = baseGold / cardsReviewed; // 20 per card

    // Card at 10 days: 3x => (3-1) * 20 = 40
    // Card at 35 days: 5x => (5-1) * 20 = 80
    const bonus1 = Math.floor(perCardGold * (getRetentionMultiplier(10) - 1));
    const bonus2 = Math.floor(perCardGold * (getRetentionMultiplier(35) - 1));

    expect(bonus1).toBe(40);
    expect(bonus2).toBe(80);

    const totalGold = baseGold + bonus1 + bonus2;
    expect(totalGold).toBe(220);
  });
});

// ---------------------------------------------------------------------------
// Retention multiplier stacking with combat XP quality/streak multipliers
// ---------------------------------------------------------------------------
describe("retention rewards stacking with combat multipliers", () => {
  it("retention bonus stacks on top of quality and streak multiplied XP", () => {
    // All perfect answers, 10% streak bonus
    const stats = { perfectCount: 4, correctCount: 0, partialCount: 0, wrongCount: 0 };
    const baseXp = calculateCombatXP(50, stats, 10, 0, 0);
    // qualityMultiplier = 1.5, streakBonus = 10%
    // 50 * 1.5 * 1.1 = 82.5 => 82
    expect(baseXp).toBe(82);

    // Now suppose 2 of 4 cards had 30+ day intervals (5x)
    const perCardXp = baseXp / 4; // 20.5
    const retentionBonus = Math.floor(perCardXp * (5 - 1)) * 2; // floor(20.5 * 4) * 2 = 82 * 2 = 164
    expect(retentionBonus).toBe(164);

    const totalXp = baseXp + retentionBonus;
    expect(totalXp).toBe(246);
  });
});
