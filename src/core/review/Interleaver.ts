import type { Card } from "../../types/index.js";

/**
 * Interleave cards from multiple decks ensuring cross-deck mixing.
 * Research shows interleaving produces ~30% better retention and
 * "near immunity against forgetting" (Bjork).
 *
 * Constraint: no more than 2 consecutive cards from the same deck.
 */
export function interleaveCards(
  cardsByDeck: Map<string, Card[]>,
  count: number,
): Card[] {
  const deckIds = Array.from(cardsByDeck.keys());

  // Single deck — no interleaving needed
  if (deckIds.length <= 1) {
    const cards = deckIds.length === 1 ? cardsByDeck.get(deckIds[0])! : [];
    return shuffleArray([...cards]).slice(0, count);
  }

  // Flatten all cards with their deck origin
  const allCards: Card[] = [];
  for (const [, cards] of cardsByDeck) {
    allCards.push(...cards);
  }

  if (allCards.length === 0) return [];

  // Shuffle all cards first
  const shuffled = shuffleArray([...allCards]);

  // Enforce max-2-consecutive constraint from same deck
  const result: Card[] = [];
  const remaining = [...shuffled];

  while (result.length < count && remaining.length > 0) {
    const lastTwo = result.slice(-2);
    const samedeckCount =
      lastTwo.length === 2 && lastTwo[0].deckId === lastTwo[1].deckId
        ? lastTwo[0].deckId
        : null;

    // Find next card that doesn't violate the constraint
    let picked = false;
    for (let i = 0; i < remaining.length; i++) {
      if (samedeckCount === null || remaining[i].deckId !== samedeckCount) {
        result.push(remaining.splice(i, 1)[0]);
        picked = true;
        break;
      }
    }

    // If we couldn't find a valid card (all remaining are from blocked deck),
    // just take the first one to avoid infinite loop
    if (!picked && remaining.length > 0) {
      result.push(remaining.shift()!);
    }
  }

  return result;
}

/**
 * Fisher-Yates shuffle.
 */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
