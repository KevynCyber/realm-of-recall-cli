// Weighted random retrieval-mode selection with recency and variety rules

import { RetrievalMode } from "../../types/index.js";

export interface ModeWeight {
  mode: RetrievalMode;
  baseWeight: number;
  recencyPenalty: number;
}

export const MODE_WEIGHTS: ModeWeight[] = [
  { mode: RetrievalMode.Standard, baseWeight: 40, recencyPenalty: 0.3 },
  { mode: RetrievalMode.Reversed, baseWeight: 25, recencyPenalty: 0.5 },
  { mode: RetrievalMode.Teach, baseWeight: 20, recencyPenalty: 0.7 },
  { mode: RetrievalMode.Connect, baseWeight: 15, recencyPenalty: 0.8 },
];

/**
 * Map from retrieval mode to the unlock key that gates it.
 * Standard is always available (no entry here).
 */
const MODE_UNLOCK_KEYS: Partial<Record<RetrievalMode, string>> = {
  [RetrievalMode.Reversed]: "reversed_mode",
  [RetrievalMode.Teach]: "teach_mode",
  [RetrievalMode.Connect]: "connect_mode",
};

/**
 * Select a retrieval mode based on card state, recency, and session variety.
 *
 * - new / relearning cards always get Standard.
 * - learning cards are restricted to Standard or Reversed.
 * - review cards use the full weighted pool.
 *
 * Recency penalty: each occurrence in `recentModesForCard` multiplies that
 * mode's effective weight by `(1 - recencyPenalty)`.
 *
 * Session variety: if the last 3 entries in `sessionModes` are all the same
 * mode, that mode is excluded from this selection.
 *
 * @param unlockedKeys If provided, only modes whose unlock key is in this set
 *   (or that have no unlock key, i.e. Standard) will be available.
 */
export function selectMode(
  cardState: string,
  recentModesForCard: RetrievalMode[],
  sessionModes: RetrievalMode[],
  rng: () => number = Math.random,
  unlockedKeys?: Set<string>,
): RetrievalMode {
  // New / relearning cards always use Standard
  if (cardState === "new" || cardState === "relearning") {
    return RetrievalMode.Standard;
  }

  // Filter modes by meta-progression unlock state (Standard always available)
  const availableWeights = unlockedKeys
    ? MODE_WEIGHTS.filter((w) => {
        const unlockKey = MODE_UNLOCK_KEYS[w.mode];
        return !unlockKey || unlockedKeys.has(unlockKey);
      })
    : MODE_WEIGHTS;

  // Determine the allowed weight entries
  let pool: ModeWeight[];
  if (cardState === "learning") {
    pool = availableWeights.filter(
      (w) => w.mode === RetrievalMode.Standard || w.mode === RetrievalMode.Reversed,
    );
  } else {
    // review (and any unknown state) — full pool
    pool = [...availableWeights];
  }

  // Session variety: exclude a mode if the last 3 session entries are identical
  if (sessionModes.length >= 3) {
    const last3 = sessionModes.slice(-3);
    if (last3[0] === last3[1] && last3[1] === last3[2]) {
      const repeatedMode = last3[0];
      const filtered = pool.filter((w) => w.mode !== repeatedMode);
      if (filtered.length > 0) {
        pool = filtered;
      }
    }
  }

  // Calculate effective weights with recency penalties applied
  const effectiveWeights = pool.map((w) => {
    let weight = w.baseWeight;
    for (const recent of recentModesForCard) {
      if (recent === w.mode) {
        weight *= 1 - w.recencyPenalty;
      }
    }
    return { mode: w.mode, weight };
  });

  // Weighted random selection
  const totalWeight = effectiveWeights.reduce((sum, e) => sum + e.weight, 0);
  const roll = rng() * totalWeight;

  let cumulative = 0;
  for (const entry of effectiveWeights) {
    cumulative += entry.weight;
    if (roll < cumulative) {
      return entry.mode;
    }
  }

  // Fallback — return last entry (guards against floating-point edge cases)
  return effectiveWeights[effectiveWeights.length - 1].mode;
}

/**
 * Damage multiplier for each retrieval mode.
 * Harder modes reward higher multipliers.
 */
export function getModeDamageMultiplier(mode: RetrievalMode): number {
  switch (mode) {
    case RetrievalMode.Standard:
      return 1.0;
    case RetrievalMode.Reversed:
      return 1.1;
    case RetrievalMode.Teach:
      return 1.5;
    case RetrievalMode.Connect:
      return 1.2;
  }
}
