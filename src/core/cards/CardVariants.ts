// CardVariants — rare card variant drop system (variable-ratio reward layer)

export type CardVariant = "foil" | "golden" | "prismatic";

/** Drop rate table, ordered rarest-first so we roll prismatic before foil. */
const DROP_TABLE: { variant: CardVariant; rate: number }[] = [
  { variant: "prismatic", rate: 0.001 },
  { variant: "golden", rate: 0.009 },
  { variant: "foil", rate: 0.04 },
];

/** Minimum consecutive correct answers required before a variant drop is possible. */
const MIN_CONSECUTIVE_CORRECT = 5;

/**
 * Attempts to award a card variant after a Perfect quality answer.
 *
 * Requirements:
 *   - consecutiveCorrect >= 5
 *   - currentVariant must be null (no overwriting existing variants)
 *
 * Drop rates (rolled in order, first match wins):
 *   - prismatic: 0.1%
 *   - golden:    0.9%
 *   - foil:      4.0%
 *
 * @param consecutiveCorrect The card's current consecutive correct count (after this answer).
 * @param currentVariant     The card's existing variant (null if none).
 * @param rng                Optional random number generator for testing (returns [0, 1)).
 * @returns The awarded variant, or null if no drop.
 */
export function tryAwardVariant(
  consecutiveCorrect: number,
  currentVariant: CardVariant | null,
  rng: () => number = Math.random,
): CardVariant | null {
  // Must have 5+ consecutive correct
  if (consecutiveCorrect < MIN_CONSECUTIVE_CORRECT) return null;

  // Never overwrite an existing variant
  if (currentVariant !== null) return null;

  const roll = rng();
  let cumulative = 0;
  for (const entry of DROP_TABLE) {
    cumulative += entry.rate;
    if (roll < cumulative) {
      return entry.variant;
    }
  }

  return null;
}
