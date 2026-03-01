import type { Player } from "../../types/index.js";

export type AchievementCategory = "learning" | "combat" | "progression" | "exploration";

export interface Achievement {
  key: string;
  title: string;
  description: string;
  category: AchievementCategory;
  check: (state: AchievementState) => boolean;
}

export interface AchievementState {
  player: Player;
  totalMasteredCards: number;
  totalCards: number;
  perfectStreak: number;
  zonesCleared: number;
  totalZones: number;
  decksOwned: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Learning (card mastery)
  { key: "first_recall", title: "First Recall", description: "Review your first card", category: "learning", check: (s) => s.player.totalReviews >= 1 },
  { key: "century_scholar", title: "Century Scholar", description: "Review 100 cards", category: "learning", check: (s) => s.player.totalReviews >= 100 },
  { key: "thousand_reviews", title: "Knowledge Seeker", description: "Review 1,000 cards", category: "learning", check: (s) => s.player.totalReviews >= 1000 },
  { key: "perfect_ten", title: "Perfect Ten", description: "Get 10 Perfect answers in a row", category: "learning", check: (s) => s.perfectStreak >= 10 },
  { key: "card_scholar", title: "Card Scholar", description: "Master 10 cards (Tier 3)", category: "learning", check: (s) => s.totalMasteredCards >= 10 },
  { key: "card_master", title: "Card Master", description: "Master 50 cards (Tier 3)", category: "learning", check: (s) => s.totalMasteredCards >= 50 },
  { key: "accuracy_ace", title: "Accuracy Ace", description: "Reach 90% overall accuracy", category: "learning", check: (s) => s.player.totalReviews > 0 && (s.player.totalCorrect / s.player.totalReviews) >= 0.9 },

  // Combat
  { key: "first_blood", title: "First Blood", description: "Win your first combat", category: "combat", check: (s) => s.player.combatWins >= 1 },
  { key: "veteran", title: "Veteran", description: "Win 10 combats", category: "combat", check: (s) => s.player.combatWins >= 10 },
  { key: "warrior_legend", title: "Warrior Legend", description: "Win 50 combats", category: "combat", check: (s) => s.player.combatWins >= 50 },
  { key: "undefeated", title: "Undefeated", description: "Win 10 combats without a single loss", category: "combat", check: (s) => s.player.combatWins >= 10 && s.player.combatLosses === 0 },
  { key: "gold_hoarder", title: "Gold Hoarder", description: "Accumulate 1,000 gold", category: "combat", check: (s) => s.player.gold >= 1000 },

  // Progression
  { key: "level_5", title: "Apprentice", description: "Reach level 5", category: "progression", check: (s) => s.player.level >= 5 },
  { key: "level_10", title: "Journeyman", description: "Reach level 10", category: "progression", check: (s) => s.player.level >= 10 },
  { key: "level_20", title: "Expert", description: "Reach level 20", category: "progression", check: (s) => s.player.level >= 20 },
  { key: "streak_7", title: "Dedicated", description: "Maintain a 7-day streak", category: "progression", check: (s) => s.player.streakDays >= 7 },
  { key: "streak_30", title: "Streak Master", description: "Maintain a 30-day streak", category: "progression", check: (s) => s.player.streakDays >= 30 },
  { key: "streak_100", title: "Streak Legend", description: "Maintain a 100-day streak", category: "progression", check: (s) => s.player.longestStreak >= 100 },
  { key: "wise_one", title: "The Wise One", description: "Earn 500 Wisdom XP", category: "progression", check: (s) => s.player.wisdomXp >= 500 },

  // Exploration
  { key: "explorer", title: "Explorer", description: "Import 3 decks", category: "exploration", check: (s) => s.decksOwned >= 3 },
  { key: "zone_clear", title: "Zone Conqueror", description: "Clear your first zone", category: "exploration", check: (s) => s.zonesCleared >= 1 },
  { key: "world_clear", title: "World Conqueror", description: "Clear all zones", category: "exploration", check: (s) => s.totalZones > 0 && s.zonesCleared >= s.totalZones },
  { key: "ascended", title: "Ascended", description: "Complete Ascension 1", category: "exploration", check: (s) => s.player.ascensionLevel >= 1 },
  { key: "ascension_5", title: "Transcendent", description: "Complete Ascension 5", category: "exploration", check: (s) => s.player.ascensionLevel >= 5 },
];

/**
 * Check for newly unlocked achievements given current state and already-unlocked keys.
 */
export function checkNewAchievements(
  state: AchievementState,
  unlockedKeys: Set<string>,
): Achievement[] {
  return ACHIEVEMENTS.filter(
    (a) => !unlockedKeys.has(a.key) && a.check(state),
  );
}

/**
 * Get all achievements by category.
 */
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}
