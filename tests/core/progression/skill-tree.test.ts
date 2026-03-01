import { describe, it, expect } from "vitest";
import {
  getBranchTier,
  getNextTierCost,
  getUnlockedNodes,
  getTotalPointsSpent,
  canInvestInBranch,
  investInBranch,
  getAggregatedEffects,
  getBranchInfo,
  RECALL_NODES,
  BATTLE_NODES,
  SCHOLAR_NODES,
  ALL_NODES,
} from "../../../src/core/progression/SkillTree.js";
import type { SkillAllocation } from "../../../src/core/progression/SkillTree.js";

const EMPTY: SkillAllocation = { recall: 0, battle: 0, scholar: 0 };

describe("getBranchTier", () => {
  it("returns 0 for no points invested", () => {
    expect(getBranchTier(0)).toBe(0);
  });

  it("returns 1 after spending 1 point (tier 1 cost)", () => {
    expect(getBranchTier(1)).toBe(1);
  });

  it("returns 2 after spending 3 points (1 + 2)", () => {
    expect(getBranchTier(3)).toBe(2);
  });

  it("returns 3 after spending 6 points (1 + 2 + 3)", () => {
    expect(getBranchTier(6)).toBe(3);
  });

  it("returns 4 after spending 10 points (1+2+3+4)", () => {
    expect(getBranchTier(10)).toBe(4);
  });

  it("returns 5 (max) after spending 15 points (1+2+3+4+5)", () => {
    expect(getBranchTier(15)).toBe(5);
  });

  it("returns tier between costs when partially spending", () => {
    // 2 points: tier 1 is unlocked (cost 1), tier 2 needs 3 total
    expect(getBranchTier(2)).toBe(1);
  });
});

describe("getNextTierCost", () => {
  it("returns 1 for tier 0", () => {
    expect(getNextTierCost(0)).toBe(1);
  });

  it("returns 2 for tier 1 (1 point spent)", () => {
    expect(getNextTierCost(1)).toBe(2);
  });

  it("returns null when fully maxed (15 points)", () => {
    expect(getNextTierCost(15)).toBeNull();
  });
});

describe("getUnlockedNodes", () => {
  it("returns empty array for no investment", () => {
    expect(getUnlockedNodes(EMPTY)).toHaveLength(0);
  });

  it("unlocks tier 1 nodes for invested branches", () => {
    const alloc: SkillAllocation = { recall: 1, battle: 0, scholar: 0 };
    const nodes = getUnlockedNodes(alloc);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("recall_1");
  });

  it("unlocks multiple tiers correctly", () => {
    const alloc: SkillAllocation = { recall: 3, battle: 1, scholar: 0 };
    const nodes = getUnlockedNodes(alloc);
    // recall: tier 2 = 2 nodes, battle: tier 1 = 1 node
    expect(nodes).toHaveLength(3);
  });

  it("unlocks all nodes when fully invested", () => {
    const alloc: SkillAllocation = { recall: 15, battle: 15, scholar: 15 };
    const nodes = getUnlockedNodes(alloc);
    expect(nodes).toHaveLength(15); // 5 per branch
  });
});

describe("getTotalPointsSpent", () => {
  it("returns 0 for empty allocation", () => {
    expect(getTotalPointsSpent(EMPTY)).toBe(0);
  });

  it("sums across all branches", () => {
    expect(getTotalPointsSpent({ recall: 3, battle: 1, scholar: 6 })).toBe(10);
  });
});

describe("canInvestInBranch", () => {
  it("allows investment when points available and branch not maxed", () => {
    expect(canInvestInBranch("recall", EMPTY, 1)).toBe(true);
  });

  it("rejects when not enough points", () => {
    expect(canInvestInBranch("recall", EMPTY, 0)).toBe(false);
  });

  it("rejects when branch is maxed", () => {
    const maxed: SkillAllocation = { recall: 15, battle: 0, scholar: 0 };
    expect(canInvestInBranch("recall", maxed, 10)).toBe(false);
  });

  it("rejects when cost exceeds available points", () => {
    // tier 2 costs 2 points, but only 1 available
    const alloc: SkillAllocation = { recall: 1, battle: 0, scholar: 0 };
    expect(canInvestInBranch("recall", alloc, 1)).toBe(false);
  });
});

describe("investInBranch", () => {
  it("returns new allocation with points invested", () => {
    const result = investInBranch("battle", EMPTY, 5);
    expect(result).not.toBeNull();
    expect(result!.allocation.battle).toBe(1);
    expect(result!.pointsSpent).toBe(1);
  });

  it("returns null when cannot invest", () => {
    expect(investInBranch("recall", EMPTY, 0)).toBeNull();
  });

  it("progresses through tiers correctly", () => {
    let alloc = EMPTY;
    let available = 15;
    // Invest all 5 tiers in recall
    for (let i = 0; i < 5; i++) {
      const result = investInBranch("recall", alloc, available);
      expect(result).not.toBeNull();
      alloc = result!.allocation;
      available -= result!.pointsSpent;
    }
    expect(getBranchTier(alloc.recall)).toBe(5);
    expect(available).toBe(0); // 1+2+3+4+5 = 15
  });
});

describe("getAggregatedEffects", () => {
  it("returns empty map for no investment", () => {
    const effects = getAggregatedEffects(EMPTY);
    expect(effects.size).toBe(0);
  });

  it("aggregates effects from multiple nodes", () => {
    // recall: tier 2 has stability_bonus(5) + retention_bonus(1)
    const alloc: SkillAllocation = { recall: 3, battle: 0, scholar: 0 };
    const effects = getAggregatedEffects(alloc);
    expect(effects.get("stability_bonus")).toBe(5);
    expect(effects.get("retention_bonus")).toBe(1);
  });

  it("stacks effects across tiers", () => {
    // recall fully maxed: stability_bonus = 5 + 10 = 15, retention_bonus = 1 + 2 = 3
    const alloc: SkillAllocation = { recall: 15, battle: 0, scholar: 0 };
    const effects = getAggregatedEffects(alloc);
    expect(effects.get("stability_bonus")).toBe(15);
    expect(effects.get("retention_bonus")).toBe(3);
    expect(effects.get("hint_bonus")).toBe(1);
  });
});

describe("getBranchInfo", () => {
  it("returns correct info for empty branch", () => {
    const info = getBranchInfo("recall", EMPTY);
    expect(info.branchName).toBe("Recall Mastery");
    expect(info.currentTier).toBe(0);
    expect(info.maxTier).toBe(5);
    expect(info.nextCost).toBe(1);
    expect(info.nodes).toHaveLength(5);
  });

  it("returns null nextCost for maxed branch", () => {
    const alloc: SkillAllocation = { recall: 0, battle: 15, scholar: 0 };
    const info = getBranchInfo("battle", alloc);
    expect(info.currentTier).toBe(5);
    expect(info.nextCost).toBeNull();
  });
});

describe("ALL_NODES", () => {
  it("has 15 total nodes (5 per branch)", () => {
    expect(ALL_NODES).toHaveLength(15);
  });

  it("has unique IDs", () => {
    const ids = new Set(ALL_NODES.map(n => n.id));
    expect(ids.size).toBe(15);
  });

  it("has 5 nodes per branch", () => {
    expect(RECALL_NODES).toHaveLength(5);
    expect(BATTLE_NODES).toHaveLength(5);
    expect(SCHOLAR_NODES).toHaveLength(5);
  });
});
