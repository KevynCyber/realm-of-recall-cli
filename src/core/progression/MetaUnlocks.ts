/**
 * Meta-progression unlocks earned through ascension levels.
 * These gate content and modes, following Slay the Spire's gradual unlock model.
 */

export interface MetaUnlock {
  key: string;
  name: string;
  description: string;
  requiredAscension: number;
}

const META_UNLOCKS: MetaUnlock[] = [
  {
    key: "reversed_mode",
    name: "Reversed Mode",
    description: "Cards are shown back-to-front during review",
    requiredAscension: 1,
  },
  {
    key: "teach_mode",
    name: "Teach Mode",
    description: "Explain the answer as if teaching someone else",
    requiredAscension: 2,
  },
  {
    key: "connect_mode",
    name: "Connect Mode",
    description: "Link the card to another concept you know",
    requiredAscension: 3,
  },
  {
    key: "generate_mode",
    name: "Generate Mode",
    description: "Answer from partial cues — first letter + blanks",
    requiredAscension: 2,
  },
  {
    key: "prismatic_variants",
    name: "Prismatic Variants",
    description: "Prismatic card variants can now drop",
    requiredAscension: 4,
  },
  {
    key: "extended_dungeon",
    name: "Extended Dungeon",
    description: "Dungeon runs now include floors 6-8",
    requiredAscension: 5,
  },
  {
    key: "nightmare_enemies",
    name: "Nightmare Enemies",
    description: "New nightmare-tier enemy name pool",
    requiredAscension: 7,
  },
  {
    key: "master_title",
    name: "Master Title",
    description: "Cosmetic 'Master' title for your character",
    requiredAscension: 10,
  },
];

/**
 * Get the required ascension level for a given unlock key.
 * Returns undefined if the key is not a valid unlock.
 */
export function getRequiredAscension(unlockKey: string): number | undefined {
  const unlock = META_UNLOCKS.find((u) => u.key === unlockKey);
  return unlock?.requiredAscension;
}

/**
 * Get all meta-unlock definitions.
 */
export function getAllUnlocks(): MetaUnlock[] {
  return [...META_UNLOCKS];
}

/**
 * Get all unlock keys that should be unlocked at the given ascension level.
 */
export function getUnlocksForAscension(ascensionLevel: number): MetaUnlock[] {
  return META_UNLOCKS.filter((u) => u.requiredAscension <= ascensionLevel);
}
