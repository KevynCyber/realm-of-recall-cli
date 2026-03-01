/**
 * Wisdom perks — tangible gameplay benefits unlocked by accumulating Wisdom XP.
 *
 * Each perk has a WXP threshold. Once the player's wisdomXp meets or exceeds
 * that threshold the perk is considered unlocked.
 */

export interface WisdomPerk {
  id: string;
  name: string;
  description: string;
  threshold: number;
}

export const WISDOM_PERKS: WisdomPerk[] = [
  {
    id: "extra_hint",
    name: "Extra Hint Level",
    description: "Adds 1 more hint level",
    threshold: 100,
  },
  {
    id: "study_shield",
    name: "Study Shield",
    description: "1 free streak shield per week",
    threshold: 250,
  },
  {
    id: "quick_learner",
    name: "Quick Learner",
    description: "New cards start at 1.1x stability",
    threshold: 500,
  },
  {
    id: "deep_focus",
    name: "Deep Focus",
    description: "+10% XP from reviews",
    threshold: 750,
  },
  {
    id: "sages_insight",
    name: "Sage's Insight",
    description: "Connect mode available",
    threshold: 1000,
  },
];

/**
 * Returns the list of perks the player has unlocked given their current wisdom XP.
 */
export function getUnlockedPerks(wisdomXp: number): WisdomPerk[] {
  return WISDOM_PERKS.filter((perk) => wisdomXp >= perk.threshold);
}

/**
 * Check whether a specific perk is unlocked.
 */
export function hasPerk(wisdomXp: number, perkId: string): boolean {
  const perk = WISDOM_PERKS.find((p) => p.id === perkId);
  if (!perk) return false;
  return wisdomXp >= perk.threshold;
}
