// Reflection engine — post-combat reflection prompts, journaling, and Wisdom XP

/**
 * Pool of RPG-themed reflection prompts shown after combat.
 */
export const REFLECTION_PROMPTS: string[] = [
  'Which card caught you off guard? Why?',
  'If you had to teach one thing from this battle, what would it be?',
  'What tactic will you try in your next battle?',
  'What mistake taught you the most today?',
  'How does your recall compare to yesterday?',
  'Was there a moment you almost gave up? What kept you going?',
  'Which card gave you the most satisfying aha moment?',
  'Did you use any memory tricks today? Which ones worked?',
  'Name one thing you know now that you didn\'t before this battle.',
  'What pattern did you notice in the cards you missed?',
  'How would you explain your toughest card to a fellow adventurer?',
  'Which cards deserve extra training before the next fight?',
  'What\'s one thing you\'d do differently if you fought this battle again?',
  'Did any card surprise you by being easier than expected?',
  'What\'s the hardest concept you faced today and why?',
];

/**
 * Selects a random prompt, avoiding the previously shown one.
 * If the pool has only one entry, returns it regardless.
 */
export function selectPrompt(
  previousPrompt: string | null,
  rng: () => number = Math.random,
): string {
  if (REFLECTION_PROMPTS.length <= 1) {
    return REFLECTION_PROMPTS[0];
  }

  let selected: string;
  do {
    selected = REFLECTION_PROMPTS[Math.floor(rng() * REFLECTION_PROMPTS.length)];
  } while (selected === previousPrompt);

  return selected;
}

/**
 * Returns true ~30% of the time, gating the journal entry flow.
 */
export function shouldShowJournal(rng: () => number = Math.random): boolean {
  return rng() < 0.3;
}

/**
 * Calculates Wisdom XP earned from reflection activities.
 *
 * - Micro-reflection only: 25 XP
 * - Journal only:          50 XP
 * - Both:                  75 XP
 * - Neither:                0 XP
 */
export function calculateWisdomXP(
  didMicroReflection: boolean,
  didJournal: boolean,
): number {
  let xp = 0;
  if (didMicroReflection) xp += 25;
  if (didJournal) xp += 50;
  return xp;
}

// Pool of compassionate process-reframe messages
const CPJ_REFRAMES: string[] = [
  'Every missed card is now primed for stronger memory.',
  'Struggling means your brain is building new connections.',
  'The cards you missed just got scheduled for extra training.',
  'Difficulty is the signal — your brain is working harder than you think.',
  'Mistakes are the raw material of mastery.',
];

/**
 * Generates Compassionate Performance Journaling (CPJ) messages.
 *
 * Only triggers when accuracy < 70%. Returns:
 *  - A factual summary line
 *  - A random process-reframe from the pool
 *  - (Optional) A journey-context line when the player is improving
 *
 * Returns an empty array if accuracy >= 0.7.
 */
export function generateCPJReframe(
  accuracy: number,
  previousAccuracies: number[],
  rng: () => number = Math.random,
): string[] {
  if (accuracy >= 0.7) return [];

  const pct = Math.round(accuracy * 100);
  const messages: string[] = [];

  // Factual summary
  messages.push(`Tough battle — ${pct}% accuracy.`);

  // Process reframe
  const reframe = CPJ_REFRAMES[Math.floor(rng() * CPJ_REFRAMES.length)];
  messages.push(reframe);

  // Journey context — only when there is history and current is above average
  if (previousAccuracies.length > 0) {
    const avg = previousAccuracies.reduce((a, b) => a + b, 0) / previousAccuracies.length;
    if (accuracy > avg) {
      const avgPct = Math.round(avg * 100);
      messages.push(`Your average was ${avgPct}%. You're getting stronger.`);
    }
  }

  return messages;
}

/**
 * Returns true if accuracy is below the CPJ threshold (70%).
 */
export function shouldShowCPJ(accuracy: number): boolean {
  return accuracy < 0.7;
}
