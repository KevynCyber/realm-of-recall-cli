/**
 * Skill tree system — players invest skill points into learning-strategy branches.
 *
 * Three branches provide passive bonuses that enhance different aspects
 * of the learning process. Each branch has 5 tiers with increasing costs
 * and benefits. Skill points are earned on level-up (1 per level).
 *
 * Branches:
 * - Recall Mastery: retention and review effectiveness
 * - Battle Prowess: combat stats and damage
 * - Scholar's Path: XP, wisdom, and learning speed
 */

// ── Types ─────────────────────────────────────────────────────

export type SkillBranch = "recall" | "battle" | "scholar";

export interface SkillNode {
  id: string;
  branch: SkillBranch;
  tier: number;
  name: string;
  description: string;
  cost: number;
  effect: SkillEffect;
}

export type SkillEffectType =
  | "stability_bonus"      // +% starting stability for new cards
  | "retention_bonus"      // +% to desired retention calculation
  | "hint_bonus"           // extra hint levels
  | "review_xp_bonus"      // +% XP from reviews
  | "combat_attack_bonus"  // +% attack in combat
  | "combat_hp_bonus"      // +% max HP
  | "combat_crit_bonus"    // +% crit chance
  | "gold_bonus"           // +% gold earnings
  | "wisdom_xp_bonus"      // +% wisdom XP
  | "new_card_bonus";      // +% new cards per day

export interface SkillEffect {
  type: SkillEffectType;
  value: number;
}

export interface SkillAllocation {
  recall: number;
  battle: number;
  scholar: number;
}

// ── Skill Nodes ──────────────────────────────────────────────

const SKILL_COST_PER_TIER = [1, 2, 3, 4, 5];

export const RECALL_NODES: SkillNode[] = [
  { id: "recall_1", branch: "recall", tier: 1, name: "Memory Foundation", description: "+5% starting stability", cost: 1, effect: { type: "stability_bonus", value: 5 } },
  { id: "recall_2", branch: "recall", tier: 2, name: "Retention Focus", description: "+1% desired retention", cost: 2, effect: { type: "retention_bonus", value: 1 } },
  { id: "recall_3", branch: "recall", tier: 3, name: "Hint Mastery", description: "+1 hint level", cost: 3, effect: { type: "hint_bonus", value: 1 } },
  { id: "recall_4", branch: "recall", tier: 4, name: "Deep Retention", description: "+10% starting stability", cost: 4, effect: { type: "stability_bonus", value: 10 } },
  { id: "recall_5", branch: "recall", tier: 5, name: "Perfect Memory", description: "+2% desired retention", cost: 5, effect: { type: "retention_bonus", value: 2 } },
];

export const BATTLE_NODES: SkillNode[] = [
  { id: "battle_1", branch: "battle", tier: 1, name: "Sharpen Blade", description: "+5% attack", cost: 1, effect: { type: "combat_attack_bonus", value: 5 } },
  { id: "battle_2", branch: "battle", tier: 2, name: "Fortify", description: "+10% max HP", cost: 2, effect: { type: "combat_hp_bonus", value: 10 } },
  { id: "battle_3", branch: "battle", tier: 3, name: "Critical Eye", description: "+5% crit chance", cost: 3, effect: { type: "combat_crit_bonus", value: 5 } },
  { id: "battle_4", branch: "battle", tier: 4, name: "War Veteran", description: "+10% attack", cost: 4, effect: { type: "combat_attack_bonus", value: 10 } },
  { id: "battle_5", branch: "battle", tier: 5, name: "Berserker", description: "+10% crit chance", cost: 5, effect: { type: "combat_crit_bonus", value: 10 } },
];

export const SCHOLAR_NODES: SkillNode[] = [
  { id: "scholar_1", branch: "scholar", tier: 1, name: "Eager Student", description: "+10% review XP", cost: 1, effect: { type: "review_xp_bonus", value: 10 } },
  { id: "scholar_2", branch: "scholar", tier: 2, name: "Treasure Hunter", description: "+10% gold", cost: 2, effect: { type: "gold_bonus", value: 10 } },
  { id: "scholar_3", branch: "scholar", tier: 3, name: "Sage's Apprentice", description: "+15% wisdom XP", cost: 3, effect: { type: "wisdom_xp_bonus", value: 15 } },
  { id: "scholar_4", branch: "scholar", tier: 4, name: "Voracious Reader", description: "+25% new cards/day", cost: 4, effect: { type: "new_card_bonus", value: 25 } },
  { id: "scholar_5", branch: "scholar", tier: 5, name: "Loremaster", description: "+20% review XP", cost: 5, effect: { type: "review_xp_bonus", value: 20 } },
];

export const ALL_NODES: SkillNode[] = [...RECALL_NODES, ...BATTLE_NODES, ...SCHOLAR_NODES];

// ── Functions ────────────────────────────────────────────────

/**
 * Get the maximum tier unlocked in a branch given spent points.
 */
export function getBranchTier(branchPoints: number): number {
  let accumulated = 0;
  for (let tier = 0; tier < SKILL_COST_PER_TIER.length; tier++) {
    accumulated += SKILL_COST_PER_TIER[tier];
    if (branchPoints < accumulated) return tier;
  }
  return SKILL_COST_PER_TIER.length; // max tier
}

/**
 * Get the cost to unlock the next tier in a branch.
 * Returns null if the branch is fully maxed.
 */
export function getNextTierCost(branchPoints: number): number | null {
  const currentTier = getBranchTier(branchPoints);
  if (currentTier >= SKILL_COST_PER_TIER.length) return null;
  return SKILL_COST_PER_TIER[currentTier];
}

/**
 * Get all unlocked nodes for a given allocation.
 */
export function getUnlockedNodes(allocation: SkillAllocation): SkillNode[] {
  const unlocked: SkillNode[] = [];
  const recallTier = getBranchTier(allocation.recall);
  const battleTier = getBranchTier(allocation.battle);
  const scholarTier = getBranchTier(allocation.scholar);

  for (const node of RECALL_NODES) {
    if (node.tier <= recallTier) unlocked.push(node);
  }
  for (const node of BATTLE_NODES) {
    if (node.tier <= battleTier) unlocked.push(node);
  }
  for (const node of SCHOLAR_NODES) {
    if (node.tier <= scholarTier) unlocked.push(node);
  }

  return unlocked;
}

/**
 * Get the total points spent across all branches.
 */
export function getTotalPointsSpent(allocation: SkillAllocation): number {
  return allocation.recall + allocation.battle + allocation.scholar;
}

/**
 * Check if a player can invest a point in a given branch.
 */
export function canInvestInBranch(
  branch: SkillBranch,
  allocation: SkillAllocation,
  availablePoints: number,
): boolean {
  const nextCost = getNextTierCost(allocation[branch]);
  if (nextCost === null) return false;
  return availablePoints >= nextCost;
}

/**
 * Invest points into a branch. Returns the new allocation, or null if not possible.
 */
export function investInBranch(
  branch: SkillBranch,
  allocation: SkillAllocation,
  availablePoints: number,
): { allocation: SkillAllocation; pointsSpent: number } | null {
  const nextCost = getNextTierCost(allocation[branch]);
  if (nextCost === null || availablePoints < nextCost) return null;

  return {
    allocation: {
      ...allocation,
      [branch]: allocation[branch] + nextCost,
    },
    pointsSpent: nextCost,
  };
}

/**
 * Aggregate all active skill effects by type.
 * Returns a map of effect type -> total value.
 */
export function getAggregatedEffects(allocation: SkillAllocation): Map<SkillEffectType, number> {
  const effects = new Map<SkillEffectType, number>();
  const nodes = getUnlockedNodes(allocation);

  for (const node of nodes) {
    const current = effects.get(node.effect.type) ?? 0;
    effects.set(node.effect.type, current + node.effect.value);
  }

  return effects;
}

/**
 * Get the branch display info including current and next tier.
 */
export function getBranchInfo(branch: SkillBranch, allocation: SkillAllocation) {
  const points = allocation[branch];
  const currentTier = getBranchTier(points);
  const nextCost = getNextTierCost(points);
  const nodes = branch === "recall" ? RECALL_NODES : branch === "battle" ? BATTLE_NODES : SCHOLAR_NODES;
  const branchName = branch === "recall" ? "Recall Mastery" : branch === "battle" ? "Battle Prowess" : "Scholar's Path";

  return {
    branch,
    branchName,
    currentTier,
    maxTier: SKILL_COST_PER_TIER.length,
    pointsInvested: points,
    nextCost,
    nodes,
  };
}
