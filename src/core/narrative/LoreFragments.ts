// Narrative lore fragments revealed on combat defeat
// Tier maps to enemy tier: 1=Minion, 2=Common, 3=Elite, 4=Boss

export interface LoreFragment {
  id: number;
  text: string;
  tier: number; // 1-4
}

export const LORE_FRAGMENTS: LoreFragment[] = [
  // Tier 1 — Minion: whispers of the world, basic world-building
  { id: 1, text: "The first scholars carved their knowledge into cave walls, believing stone would outlast memory. They were wrong — only recall endures.", tier: 1 },
  { id: 2, text: "Slimes are drawn to places where forgotten thoughts pool. They feed on abandoned memories, growing stronger with each one.", tier: 1 },
  { id: 3, text: "The ancient Library of Intervals was built on a simple truth: knowledge reviewed at the right moment becomes permanent.", tier: 1 },
  { id: 4, text: "Wisps are the remnants of memories that were never reinforced. They flicker briefly, then vanish — as all unreviewed knowledge does.", tier: 1 },
  { id: 5, text: "Village elders teach children using call-and-response chants. They discovered long ago that retrieval builds stronger traces than rereading ever could.", tier: 1 },

  // Tier 2 — Common: deeper history, enemy origins
  { id: 6, text: "The Goblin clans were once human scholars who hoarded knowledge instead of sharing it. The curse twisted their forms to match their greed.", tier: 2 },
  { id: 7, text: "Skeletons rise in the ruins of old academies, endlessly repeating lectures no one remembers. Their bones rattle with half-recalled theorems.", tier: 2 },
  { id: 8, text: "The Spacing Wars began when the Guild of Immediate Recall declared spaced repetition heretical. They crammed for battle and lost everything.", tier: 2 },
  { id: 9, text: "Bandits raid memory caravans not for gold, but for encoded scrolls. A stolen memory, they say, is worth more than a stolen coin.", tier: 2 },
  { id: 10, text: "Wolves of the Forgetting Forest hunt in patterns that mirror the forgetting curve — striking just as confidence fades.", tier: 2 },

  // Tier 3 — Elite: ancient scholars, forbidden knowledge
  { id: 11, text: "The Dark Mages discovered that forcing recall under pressure creates traces twice as strong. They built arenas of combat and review as one.", tier: 3 },
  { id: 12, text: "Sir Ebbinghaus mapped the forgetting curve in his own blood, proving that memory decays exponentially — unless deliberately retrieved.", tier: 3 },
  { id: 13, text: "Golems are constructed from compressed textbooks, animated by the frustrated energy of students who never learned to space their practice.", tier: 3 },
  { id: 14, text: "The Assassin's Guild trains by interleaving combat styles — never practicing the same technique twice in a row. Variety forges mastery.", tier: 3 },
  { id: 15, text: "Wraiths are scholars who achieved perfect recall but lost all understanding. They are a warning: memorization without meaning is hollow.", tier: 3 },

  // Tier 4 — Boss: forgotten knowledge, cosmic truths
  { id: 16, text: "The Dragon of Retention guards the Vault of Permanent Memory. It tests all who enter with questions from their deepest past.", tier: 4 },
  { id: 17, text: "The Lich was once the greatest teacher alive. Seeking immortality through knowledge alone, it discovered that wisdom requires forgetting as much as remembering.", tier: 4 },
  { id: 18, text: "In the age before the Forgetting, all knowledge was instantly accessible. Scholars grew weak, unable to recall anything without their crystal archives.", tier: 4 },
  { id: 19, text: "The Shadow King rules the Realm of Lapsed Memories — a domain of everything once known and never reviewed. His kingdom grows with every abandoned deck.", tier: 4 },
  { id: 20, text: "The Ancient Wyrm whispers: 'Every defeat is a desirable difficulty. The struggle to recall is not failure — it is the very mechanism of learning.'", tier: 4 },
];

const TIER_MAP: Record<string, number> = {
  minion: 1,
  common: 2,
  elite: 3,
  boss: 4,
};

/**
 * Convert an EnemyTier string value to a numeric tier (1-4).
 */
export function enemyTierToNumber(tier: string): number {
  return TIER_MAP[tier] ?? 1;
}

/**
 * Get all lore fragments for a given numeric tier (1-4).
 */
export function getLoreForTier(tier: number): LoreFragment[] {
  return LORE_FRAGMENTS.filter((f) => f.tier === tier);
}

/**
 * Select a random lore fragment matching the given enemy tier,
 * avoiding IDs that have already been seen this session.
 * Falls back to any unseen lore if the tier is exhausted,
 * then falls back to any lore at all if everything has been seen.
 *
 * @param enemyTier - The EnemyTier string value (e.g., "minion", "boss")
 * @param seenIds - Set of lore IDs already shown this session
 * @param rng - Optional random function for deterministic testing
 * @returns The selected lore fragment
 */
export function selectLore(
  enemyTier: string,
  seenIds: Set<number>,
  rng: () => number = Math.random,
): LoreFragment {
  const numericTier = enemyTierToNumber(enemyTier);

  // Try tier-matched unseen lore first
  const tierLore = getLoreForTier(numericTier);
  const unseenTierLore = tierLore.filter((f) => !seenIds.has(f.id));
  if (unseenTierLore.length > 0) {
    return unseenTierLore[Math.floor(rng() * unseenTierLore.length)];
  }

  // Fall back to any unseen lore
  const allUnseen = LORE_FRAGMENTS.filter((f) => !seenIds.has(f.id));
  if (allUnseen.length > 0) {
    return allUnseen[Math.floor(rng() * allUnseen.length)];
  }

  // All lore seen this session — allow repeats from matching tier
  if (tierLore.length > 0) {
    return tierLore[Math.floor(rng() * tierLore.length)];
  }

  // Ultimate fallback
  return LORE_FRAGMENTS[Math.floor(rng() * LORE_FRAGMENTS.length)];
}
