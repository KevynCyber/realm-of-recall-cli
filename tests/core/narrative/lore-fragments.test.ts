import { describe, it, expect } from "vitest";
import {
  LORE_FRAGMENTS,
  getLoreForTier,
  selectLore,
  enemyTierToNumber,
} from "../../../src/core/narrative/LoreFragments.js";

describe("LORE_FRAGMENTS", () => {
  it("contains exactly 20 lore entries", () => {
    expect(LORE_FRAGMENTS).toHaveLength(20);
  });

  it("has unique IDs for all entries", () => {
    const ids = LORE_FRAGMENTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(20);
  });

  it("all entries have tiers between 1 and 4", () => {
    for (const f of LORE_FRAGMENTS) {
      expect(f.tier).toBeGreaterThanOrEqual(1);
      expect(f.tier).toBeLessThanOrEqual(4);
    }
  });

  it("has 5 entries per tier", () => {
    for (let tier = 1; tier <= 4; tier++) {
      const count = LORE_FRAGMENTS.filter((f) => f.tier === tier).length;
      expect(count).toBe(5);
    }
  });

  it("all entries have non-empty text", () => {
    for (const f of LORE_FRAGMENTS) {
      expect(f.text.length).toBeGreaterThan(0);
    }
  });
});

describe("enemyTierToNumber", () => {
  it("maps minion to 1", () => {
    expect(enemyTierToNumber("minion")).toBe(1);
  });

  it("maps common to 2", () => {
    expect(enemyTierToNumber("common")).toBe(2);
  });

  it("maps elite to 3", () => {
    expect(enemyTierToNumber("elite")).toBe(3);
  });

  it("maps boss to 4", () => {
    expect(enemyTierToNumber("boss")).toBe(4);
  });

  it("defaults to 1 for unknown tiers", () => {
    expect(enemyTierToNumber("unknown")).toBe(1);
  });
});

describe("getLoreForTier", () => {
  it("returns 5 entries for tier 1 (Minion)", () => {
    const lore = getLoreForTier(1);
    expect(lore).toHaveLength(5);
    for (const f of lore) {
      expect(f.tier).toBe(1);
    }
  });

  it("returns 5 entries for tier 2 (Common)", () => {
    const lore = getLoreForTier(2);
    expect(lore).toHaveLength(5);
    for (const f of lore) {
      expect(f.tier).toBe(2);
    }
  });

  it("returns 5 entries for tier 3 (Elite)", () => {
    const lore = getLoreForTier(3);
    expect(lore).toHaveLength(5);
    for (const f of lore) {
      expect(f.tier).toBe(3);
    }
  });

  it("returns 5 entries for tier 4 (Boss)", () => {
    const lore = getLoreForTier(4);
    expect(lore).toHaveLength(5);
    for (const f of lore) {
      expect(f.tier).toBe(4);
    }
  });

  it("returns empty array for non-existent tier", () => {
    expect(getLoreForTier(5)).toHaveLength(0);
    expect(getLoreForTier(0)).toHaveLength(0);
  });
});

describe("selectLore", () => {
  it("selects lore matching the given enemy tier", () => {
    const lore = selectLore("boss", new Set(), () => 0);
    expect(lore.tier).toBe(4);
  });

  it("selects lore matching minion tier", () => {
    const lore = selectLore("minion", new Set(), () => 0);
    expect(lore.tier).toBe(1);
  });

  it("selects lore matching common tier", () => {
    const lore = selectLore("common", new Set(), () => 0);
    expect(lore.tier).toBe(2);
  });

  it("selects lore matching elite tier", () => {
    const lore = selectLore("elite", new Set(), () => 0);
    expect(lore.tier).toBe(3);
  });

  it("avoids lore IDs already seen this session", () => {
    // Mark all tier 1 lore IDs except one as seen
    const tier1Lore = getLoreForTier(1);
    const seen = new Set(tier1Lore.slice(0, 4).map((f) => f.id));
    const remaining = tier1Lore[4];

    const lore = selectLore("minion", seen, () => 0);
    expect(lore.id).toBe(remaining.id);
  });

  it("never repeats within same session until all tier lore is exhausted", () => {
    const seen = new Set<number>();
    const selectedIds: number[] = [];

    // Select 5 lore fragments for minion tier (exhausts all tier 1)
    for (let i = 0; i < 5; i++) {
      const lore = selectLore("minion", seen, () => 0);
      expect(selectedIds).not.toContain(lore.id);
      selectedIds.push(lore.id);
      seen.add(lore.id);
    }

    // All 5 tier 1 IDs should have been selected
    expect(selectedIds).toHaveLength(5);
    const tier1Ids = getLoreForTier(1).map((f) => f.id);
    for (const id of selectedIds) {
      expect(tier1Ids).toContain(id);
    }
  });

  it("falls back to other tiers when current tier is exhausted", () => {
    // Mark all tier 1 lore as seen
    const tier1Ids = getLoreForTier(1).map((f) => f.id);
    const seen = new Set(tier1Ids);

    const lore = selectLore("minion", seen, () => 0);
    // Should get lore from a different tier
    expect(lore.tier).not.toBe(1);
    expect(seen.has(lore.id)).toBe(false);
  });

  it("allows repeats when all 20 lore fragments have been seen", () => {
    // Mark all lore as seen
    const allIds = new Set(LORE_FRAGMENTS.map((f) => f.id));
    expect(allIds.size).toBe(20);

    // Should still return a lore fragment (allows repeats)
    const lore = selectLore("boss", allIds, () => 0);
    expect(lore).toBeDefined();
    expect(lore.tier).toBe(4); // Should prefer matching tier
  });

  it("uses rng for deterministic selection", () => {
    const lore1 = selectLore("minion", new Set(), () => 0);
    const lore2 = selectLore("minion", new Set(), () => 0.99);
    // With 5 entries, index 0 vs index 4 should give different results
    // (unless rng * 5 floors the same, which it won't for 0 vs 0.99)
    expect(lore1.tier).toBe(1);
    expect(lore2.tier).toBe(1);
  });

  it("returns a valid lore fragment with default rng", () => {
    const lore = selectLore("common", new Set());
    expect(lore).toBeDefined();
    expect(lore.id).toBeGreaterThanOrEqual(1);
    expect(lore.id).toBeLessThanOrEqual(20);
    expect(lore.text.length).toBeGreaterThan(0);
  });
});
