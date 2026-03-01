/**
 * Diminishing-cues hint generator for progressive recall scaffolding.
 * Based on Fiechter & Benjamin (2017) research showing that diminishing cues
 * enhance memory when standard retrieval practice fails.
 */

/**
 * Generate a hint for the given answer at the specified reveal level.
 * Level 0: first letter only (e.g., "P________")
 * Level 1: first letter + every 3rd letter revealed
 * Level 2: first letter + every other letter revealed
 * Level 3: full answer (fallback)
 *
 * Spaces are always revealed to preserve word structure.
 */
export function generateHint(answer: string, level: number, maxLevel: number = 3): string {
  if (level >= maxLevel) return answer;
  if (answer.length === 0) return "";

  const chars = answer.split("");
  return chars
    .map((char, index) => {
      // Always reveal spaces to show word structure
      if (char === " ") return " ";
      // Always reveal first character
      if (index === 0) return char;

      switch (level) {
        case 0:
          // Level 0: first letter only
          return "_";
        case 1:
          // Level 1: first letter + every 3rd letter
          return index % 3 === 0 ? char : "_";
        case 2:
          // Level 2: first letter + every other letter
          return index % 2 === 0 ? char : "_";
        case 3:
          // Level 3 (bonus): first letter + 2 of every 3 letters
          return index % 3 !== 0 ? char : "_";
        default:
          return "_";
      }
    })
    .join("");
}

/**
 * Get the maximum hint level available (base 3, can be increased by skill tree).
 */
export function getMaxHintLevel(hintBonus: number = 0): number {
  return 3 + hintBonus;
}

/**
 * Check if a hint level reveals the full answer.
 */
export function isFullReveal(level: number, maxLevel: number = 3): boolean {
  return level >= maxLevel;
}

/**
 * Generate a partial cue for the Generation Effect retrieval mode.
 * Shows only the first letter of each word and underscores for the rest.
 * This forces the learner to generate the answer from minimal cues (Bertsch et al. 2007).
 *
 * Examples:
 *   "Paris" → "P____"
 *   "New York" → "N__ Y___"
 *   "A" → "A"
 *   "" → ""
 */
export function generatePartialCue(answer: string): string {
  if (answer.length === 0) return "";

  return answer
    .split(" ")
    .map((word) => {
      if (word.length === 0) return "";
      if (word.length === 1) return word[0];
      return word[0] + "_".repeat(word.length - 1);
    })
    .join(" ");
}
