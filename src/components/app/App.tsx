import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { ThemeProvider } from "./ThemeProvider.js";
import { Header } from "./Header.js";
import { StatusBar } from "./StatusBar.js";
import { BreakSuggestion } from "./BreakSuggestion.js";
import { TitleScreen } from "../screens/TitleScreen.js";
import { HubScreen } from "../screens/HubScreen.js";
import { CombatScreen } from "../screens/CombatScreen.js";
import { InventoryScreen } from "../screens/InventoryScreen.js";
import { MapScreen } from "../screens/MapScreen.js";
import { StatsScreen } from "../screens/StatsScreen.js";
import { DeckScreen } from "../screens/DeckScreen.js";
import { CardCreatorScreen } from "../screens/CardCreatorScreen.js";
import { AchievementScreen } from "../screens/AchievementScreen.js";
import { DailyChallengeScreen } from "../screens/DailyChallengeScreen.js";
import { DungeonRunScreen } from "../screens/DungeonRunScreen.js";
import type { FloorCombatResult } from "../screens/DungeonRunScreen.js";
import {
  getCurrentFloorConfig,
  scaleEnemyForFloor,
  createDungeonRun,
} from "../../core/combat/DungeonRun.js";
import { RandomEventScreen } from "../screens/RandomEventScreen.js";
import { WelcomeBackScreen } from "../screens/WelcomeBackScreen.js";
import {
  getBacklogInfo,
  getBacklogSessionCardIds,
} from "../../core/backlog/BacklogManager.js";
import type { BacklogSessionOption } from "../../core/backlog/BacklogManager.js";
import { ReviewScreen } from "../review/ReviewScreen.js";
import type { ReviewResult } from "../review/ReviewScreen.js";
import { ReviewSummary } from "../review/ReviewSummary.js";
import { ReflectionScreen } from "../review/ReflectionScreen.js";
import { getDatabase } from "../../data/database.js";
import { PlayerRepository } from "../../data/repositories/PlayerRepository.js";
import { CardRepository } from "../../data/repositories/CardRepository.js";
import { StatsRepository } from "../../data/repositories/StatsRepository.js";
import { EquipmentRepository } from "../../data/repositories/EquipmentRepository.js";
import { ZoneRepository } from "../../data/repositories/ZoneRepository.js";
import { ReflectionRepository } from "../../data/repositories/ReflectionRepository.js";
import { AchievementRepository } from "../../data/repositories/AchievementRepository.js";
import { createNewPlayer } from "../../core/player/PlayerStats.js";
import { generateEnemy } from "../../core/combat/EnemyGenerator.js";
import {
  updateSchedule,
  createInitialSchedule,
} from "../../core/spaced-repetition/Scheduler.js";
import { applyLevelUp } from "../../core/progression/LevelSystem.js";
import { getRetentionMultiplier } from "../../core/progression/XPCalculator.js";
import {
  updateStreak,
  getStreakBonus,
  isStreakAtRisk,
} from "../../core/progression/StreakTracker.js";
import {
  selectPrompt,
  shouldShowJournal,
  generateCPJReframe,
  shouldShowCPJ,
} from "../../core/reflection/ReflectionEngine.js";
import { evaluateEvolutionTier } from "../../core/cards/CardEvolution.js";
import type { EvolutionTier } from "../../core/cards/CardEvolution.js";
import { tryAwardVariant } from "../../core/cards/CardVariants.js";
import {
  calculateTrend,
} from "../../core/analytics/MarginalGains.js";
import { checkNewAchievements } from "../../core/progression/Achievements.js";
import type { AchievementState } from "../../core/progression/Achievements.js";
import { hasPerk } from "../../core/progression/WisdomPerks.js";
import { interleaveCards } from "../../core/review/Interleaver.js";
import { selectMode } from "../../core/review/ModeSelector.js";
import {
  applyAscensionToEnemy,
  applyAscensionToCombat,
  getDefaultCombatSettings,
  getActiveModifiers,
  canUnlockNextAscension,
} from "../../core/progression/AscensionSystem.js";
import type { CombatSettings } from "../../core/progression/AscensionSystem.js";
import {
  getDailySeed,
  generateDailyChallenge,
} from "../../core/combat/DailyChallenge.js";
import { rollForEvent, resolveEventChoice } from "../../core/combat/RandomEvents.js";
import { playBel } from "../../core/ui/TerminalEffects.js";
import {
  getBreakLevel,
  getBreakMessage,
  isBreakSuppressed,
} from "../../core/session/SessionGuardrails.js";
import { calculateIdleRewards } from "../../core/progression/IdleRewards.js";
import type { BreakLevel } from "../../core/session/SessionGuardrails.js";
import type { RandomEvent, EventOutcome } from "../../core/combat/RandomEvents.js";
import type { DailyChallengeConfig } from "../../core/combat/DailyChallenge.js";
import type {
  Player,
  Equipment,
  Card,
  Deck,
  Zone,
  ScheduleData,
} from "../../types/index.js";
import { AnswerQuality, CardType, PlayerClass, RetrievalMode } from "../../types/index.js";
import type { CombatResult } from "../../types/combat.js";
import type { Enemy } from "../../types/combat.js";
import type { TrendResult } from "../../core/analytics/MarginalGains.js";

export type Screen =
  | "title"
  | "hub"
  | "welcome_back"
  | "combat"
  | "review"
  | "review_summary"
  | "reflection"
  | "inventory"
  | "map"
  | "stats"
  | "decks"
  | "achievements"
  | "daily_challenge"
  | "dungeon"
  | "random_event"
  | "create_cards";

interface NavigationContextValue {
  navigate: (screen: Screen) => void;
  currentScreen: Screen;
}

export const NavigationContext = React.createContext<NavigationContextValue>({
  navigate: () => {},
  currentScreen: "title",
});

export function useNavigation(): NavigationContextValue {
  return React.useContext(NavigationContext);
}

function getTodayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>("title");
  const [player, setPlayer] = useState<Player | null>(null);
  const [cardsDue, setCardsDue] = useState(0);
  const [newCardsRemaining, setNewCardsRemaining] = useState(0);

  // Screen-specific data
  const [combatCards, setCombatCards] = useState<Card[]>([]);
  const [combatEnemy, setCombatEnemy] = useState<Enemy | null>(null);
  const [combatSettings, setCombatSettings] = useState<CombatSettings>(getDefaultCombatSettings());
  const [equippedItems, setEquippedItems] = useState<Equipment[]>([]);
  const [inventoryData, setInventoryData] = useState<
    Array<{ equipment: Equipment; equipped: boolean; inventoryId: number }>
  >([]);
  const [zoneData, setZoneData] = useState<
    Array<{
      zone: Zone;
      total: number;
      mastered: number;
      masteryPct: number;
      isUnlocked: boolean;
    }>
  >([]);
  const [deckStats, setDeckStats] = useState<
    Array<{ name: string; total: number; mastered: number; accuracy: number }>
  >([]);
  const [fsrsStats, setFsrsStats] = useState({
    newCount: 0,
    learningCount: 0,
    reviewCount: 0,
    relearnCount: 0,
  });
  const [deckData, setDeckData] = useState<
    Array<{ deck: Deck; cardCount: number; dueCount: number; suspendedCount: number }>
  >([]);
  const [cardCreatorDecks, setCardCreatorDecks] = useState<Deck[]>([]);
  const [reviewResults, setReviewResults] = useState<ReviewResult[]>([]);
  const [reviewXp, setReviewXp] = useState(0);
  const [retentionBonusCards, setRetentionBonusCards] = useState<{ cardId: string; multiplier: number }[]>([]);
  const [leveledUp, setLeveledUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  const [sessionNewVariants, setSessionNewVariants] = useState<Array<{ cardId: string; variant: "foil" | "golden" | "prismatic" }>>([]);

  // Retrieval mode state
  const [currentRetrievalMode, setCurrentRetrievalMode] = useState<RetrievalMode>(RetrievalMode.Standard);
  const [sessionModes, setSessionModes] = useState<RetrievalMode[]>([]);

  // Achievement state
  const [unlockedAchievementKeys, setUnlockedAchievementKeys] = useState<Set<string>>(new Set());

  // Daily challenge state
  const [dailyChallengeConfig, setDailyChallengeConfig] = useState<DailyChallengeConfig | null>(null);

  // Ascension state for map screen
  const [mapAscensionLevel, setMapAscensionLevel] = useState(0);
  const [mapCanAscend, setMapCanAscend] = useState(false);

  // Post-combat random event state
  const [randomEvent, setRandomEvent] = useState<RandomEvent | null>(null);
  const [eventOutcome, setEventOutcome] = useState<EventOutcome | null>(null);

  // Dungeon combat state
  const [isDungeonFloor, setIsDungeonFloor] = useState(false);
  const [dungeonFloorCombatResult, setDungeonFloorCombatResult] = useState<FloorCombatResult | null>(null);
  const [dungeonRunState, setDungeonRunState] = useState<import("../../core/combat/DungeonRun.js").DungeonRunState | null>(null);
  const [dungeonCombatStartHp, setDungeonCombatStartHp] = useState<number | undefined>(undefined);

  // Reflection flow state
  const [reflectionAccuracy, setReflectionAccuracy] = useState(0);
  const [reflectionCardsReviewed, setReflectionCardsReviewed] = useState(0);
  const [reflectionCpjMessages, setReflectionCpjMessages] = useState<
    string[] | undefined
  >(undefined);
  const [reflectionShowJournal, setReflectionShowJournal] = useState(false);
  const [reflectionPrompt, setReflectionPrompt] = useState("");
  const [reflectionDeckId, setReflectionDeckId] = useState<string | undefined>(
    undefined,
  );

  // Session timing for break suggestions
  const [sessionStartMs] = useState<number>(Date.now());
  const [breakLevel, setBreakLevel] = useState<BreakLevel>("none");
  const [breakDismissed, setBreakDismissed] = useState(false);
  const [showBreakScreen, setShowBreakScreen] = useState(false);
  const sessionCardsReviewed = useRef(0);

  // Backlog / Welcome Back state
  const [backlogDaysSince, setBacklogDaysSince] = useState(0);
  const [backlogOverdueCount, setBacklogOverdueCount] = useState(0);
  const [backlogOverdueCardIds, setBacklogOverdueCardIds] = useState<string[]>([]);

  // Idle progression banner
  const [idleBanner, setIdleBanner] = useState<string | null>(null);

  // Marginal gains data for stats screen
  const [accuracyTrend, setAccuracyTrend] = useState<TrendResult | undefined>(
    undefined,
  );
  const [speedTrend, setSpeedTrend] = useState<TrendResult | undefined>(
    undefined,
  );

  const refreshCardsDue = useCallback(() => {
    try {
      const db = getDatabase();
      const cardRepo = new CardRepository(db);
      const statsRepo = new StatsRepository(db);
      const playerRepo = new PlayerRepository(db);
      const p = playerRepo.getPlayer();
      const maxNew = p?.maxNewCardsPerDay ?? 20;
      const equippedIds = cardRepo.getEquippedDeckIds();
      const { cardIds, newCardsRemaining: remaining } = statsRepo.getDueCardsWithNewLimit(equippedIds, maxNew, 9999);
      setCardsDue(cardIds.length);
      setNewCardsRemaining(remaining);
    } catch {
      // ignore
    }
  }, []);

  const reloadPlayer = useCallback(() => {
    try {
      const db = getDatabase();
      const playerRepo = new PlayerRepository(db);
      const p = playerRepo.getPlayer();
      if (p) setPlayer(p);
    } catch {
      // ignore
    }
  }, []);

  // Load player on mount
  useEffect(() => {
    try {
      const db = getDatabase();
      const playerRepo = new PlayerRepository(db);
      const p = playerRepo.getPlayer();
      if (p) {
        // Compute idle rewards before setting player state
        const idleResult = calculateIdleRewards(
          p.lastLoginAt,
          new Date(),
          p.hp,
          p.maxHp,
        );
        if (idleResult && (idleResult.gold > 0 || idleResult.hpRecovered > 0)) {
          p.gold += idleResult.gold;
          p.hp = Math.min(p.hp + idleResult.hpRecovered, p.maxHp);
          p.lastLoginAt = new Date().toISOString();
          playerRepo.updatePlayer(p);
          const parts: string[] = [];
          if (idleResult.gold > 0) parts.push(`Earned ${idleResult.gold} gold`);
          if (idleResult.hpRecovered > 0) parts.push(`recovered ${idleResult.hpRecovered} HP`);
          setIdleBanner(`Welcome back! ${parts.join(", ")} while training.`);
          setTimeout(() => setIdleBanner(null), 3000);
        } else {
          // Update last_login_at even if no rewards
          p.lastLoginAt = new Date().toISOString();
          playerRepo.updatePlayer(p);
        }
        setPlayer(p);
        const cardRepo = new CardRepository(db);
        const statsRepo = new StatsRepository(db);
        const equippedIds = cardRepo.getEquippedDeckIds();
        const maxNew = p.maxNewCardsPerDay ?? 20;
        const { cardIds, newCardsRemaining: remaining } = statsRepo.getDueCardsWithNewLimit(equippedIds, maxNew, 9999);
        setCardsDue(cardIds.length);
        setNewCardsRemaining(remaining);

        // Check for backlog to show WelcomeBack flow
        const overdueIds = statsRepo.getOverdueCardIds();
        const lastReviewTs = statsRepo.getLastReviewTimestamp();
        const backlog = getBacklogInfo(overdueIds.length, lastReviewTs);
        if (backlog.shouldShowWelcomeBack) {
          setBacklogDaysSince(backlog.daysSinceLastReview);
          setBacklogOverdueCount(backlog.overdueCount);
          setBacklogOverdueCardIds(overdueIds);
          setScreen("welcome_back");
        } else {
          setScreen("hub");
        }
      }
    } catch {
      // ignore — show title screen
    }
  }, []);

  // Poll session duration every 30s to update break level
  useEffect(() => {
    if (isBreakSuppressed()) return;
    const interval = setInterval(() => {
      const level = getBreakLevel(sessionStartMs, Date.now());
      setBreakLevel(level);
    }, 30_000);
    return () => clearInterval(interval);
  }, [sessionStartMs]);

  const checkAchievements = useCallback((updatedPlayer: Player) => {
    try {
      const db = getDatabase();
      const achievementRepo = new AchievementRepository(db);
      const cardRepo = new CardRepository(db);
      const zoneRepo = new ZoneRepository(db);
      const statsRepo = new StatsRepository(db);

      const unlockedKeys = achievementRepo.getUnlockedKeys();
      const decks = cardRepo.getAllDecks();
      const zones = zoneRepo.getZones();
      const zonesCleared = zones.filter((z) => z.bossDefeated).length;

      // Count mastered cards across all decks
      let totalMastered = 0;
      let totalCards = 0;
      for (const deck of decks) {
        const mastery = statsRepo.getDeckMasteryStats(deck.id);
        totalMastered += mastery.reviewCount;
        totalCards += mastery.total;
      }

      const state: AchievementState = {
        player: updatedPlayer,
        totalMasteredCards: totalMastered,
        totalCards,
        perfectStreak: 0, // Would need to track this separately
        zonesCleared,
        totalZones: zones.length,
        decksOwned: decks.length,
      };

      const newAchievements = checkNewAchievements(state, unlockedKeys);
      for (const achievement of newAchievements) {
        achievementRepo.unlock(achievement.key, achievement.title, achievement.description);
      }
      if (newAchievements.length > 0) playBel();
    } catch {
      // ignore
    }
  }, []);

  const handleCreatePlayer = useCallback(
    (name: string, playerClass: PlayerClass) => {
      try {
        const db = getDatabase();
        const playerRepo = new PlayerRepository(db);
        const p = createNewPlayer(name, playerClass);
        playerRepo.createPlayer(p);
        setPlayer(p);
        refreshCardsDue();
        setScreen("hub");
      } catch (err: any) {
        console.error("Failed to create player:", err.message);
      }
    },
    [refreshCardsDue],
  );

  const prepareCombat = useCallback(
    (deckId?: string) => {
      if (!player) return false;
      try {
        const db = getDatabase();
        const cardRepo = new CardRepository(db);
        const statsRepo = new StatsRepository(db);
        const equipRepo = new EquipmentRepository(db);

        const maxNew = player.maxNewCardsPerDay ?? 20;
        let cards: Card[];
        if (deckId) {
          // Zone-specific combat: pull from single deck with new card limit
          const { cardIds } = statsRepo.getDueCardsWithNewLimit(deckId, maxNew, 10);
          cards = cardIds
            .map((id) => cardRepo.getCard(id))
            .filter((c): c is Card => c !== undefined);
        } else {
          // Hub combat: interleave across equipped decks with new card limit
          const equippedDeckIds = cardRepo.getEquippedDeckIds();
          const cardsByDeck = new Map<string, Card[]>();
          for (const did of equippedDeckIds) {
            const { cardIds } = statsRepo.getDueCardsWithNewLimit(did, maxNew, 20);
            const deckCards = cardIds
              .map((id) => cardRepo.getCard(id))
              .filter((c): c is Card => c !== undefined);
            if (deckCards.length > 0) {
              cardsByDeck.set(did, deckCards);
            }
          }
          cards = interleaveCards(cardsByDeck, 10);
        }
        if (cards.length === 0) return false;

        let enemy = generateEnemy(5, player.level);
        // Apply ascension modifiers to enemy
        if (player.ascensionLevel > 0) {
          enemy = applyAscensionToEnemy(enemy, player.ascensionLevel);
        }

        // Apply ascension modifiers to combat settings (use player's configured timer)
        const baseSettings = getDefaultCombatSettings();
        baseSettings.timerSeconds = player.timerSeconds;
        const settings = applyAscensionToCombat(baseSettings, player.ascensionLevel);

        // Select retrieval mode for combat
        const mode = selectMode("review", [], sessionModes);
        setCurrentRetrievalMode(mode);
        setSessionModes((prev) => [...prev, mode]);

        const equipped = equipRepo.getEquipped();
        setCombatCards(cards);
        setCombatEnemy(enemy);
        setCombatSettings(settings);
        setEquippedItems(equipped);
        return true;
      } catch {
        return false;
      }
    },
    [player, sessionModes],
  );

  const navigateToScreen = useCallback(
    (target: string) => {
      switch (target) {
        case "combat": {
          if (prepareCombat()) {
            setScreen("combat");
          }
          break;
        }
        case "review": {
          try {
            const db = getDatabase();
            const cardRepo = new CardRepository(db);
            const statsRepo = new StatsRepository(db);
            const equippedIds = cardRepo.getEquippedDeckIds();
            const maxNew = player?.maxNewCardsPerDay ?? 20;
            const { cardIds: dueIds } = statsRepo.getDueCardsWithNewLimit(equippedIds, maxNew, 20);
            const cards = dueIds
              .map((id) => cardRepo.getCard(id))
              .filter((c): c is Card => c !== undefined);
            if (cards.length === 0) break;
            // Select retrieval mode for this review session
            const mode = selectMode("review", [], sessionModes);
            setCurrentRetrievalMode(mode);
            setSessionModes((prev) => [...prev, mode]);
            setCombatCards(cards);
            setReviewResults([]);
            setScreen("review");
          } catch {
            // ignore
          }
          break;
        }
        case "inventory": {
          try {
            const db = getDatabase();
            const equipRepo = new EquipmentRepository(db);
            setEquippedItems(equipRepo.getEquipped());
            setInventoryData(
              equipRepo.getInventory() as Array<{
                equipment: Equipment;
                equipped: boolean;
                inventoryId: number;
              }>,
            );
            setScreen("inventory");
          } catch {
            // ignore
          }
          break;
        }
        case "map": {
          if (!player) break;
          try {
            const db = getDatabase();
            const statsRepo = new StatsRepository(db);
            const zoneRepo = new ZoneRepository(db);
            const zones = zoneRepo.getZones();
            const zoneInfos = zones.map((zone, index) => {
              const mastery = statsRepo.getDeckMasteryStats(zone.deckId);
              const masteredCount = mastery.reviewCount;
              const total = mastery.total;
              const masteryPct = total > 0 ? masteredCount / total : 0;
              const isUnlocked =
                index === 0 || (index > 0 && zones[index - 1].bossDefeated);
              return {
                zone,
                total,
                mastered: masteredCount,
                masteryPct,
                isUnlocked,
              };
            });
            setZoneData(zoneInfos);
            setMapAscensionLevel(player.ascensionLevel);
            setMapCanAscend(canUnlockNextAscension(player.ascensionLevel, zones));
            setScreen("map");
          } catch {
            // ignore
          }
          break;
        }
        case "stats": {
          if (!player) break;
          try {
            const db = getDatabase();
            const cardRepo = new CardRepository(db);
            const statsRepo = new StatsRepository(db);
            const decks = cardRepo.getAllDecks();
            const ds = decks.map((deck) => {
              const mastery = statsRepo.getDeckMasteryStats(deck.id);
              return {
                name: deck.name,
                total: mastery.total,
                mastered: mastery.reviewCount,
                accuracy:
                  player.totalReviews > 0
                    ? Math.round(
                        (player.totalCorrect / player.totalReviews) * 100,
                      )
                    : 0,
              };
            });
            let agg = {
              newCount: 0,
              learningCount: 0,
              reviewCount: 0,
              relearnCount: 0,
            };
            for (const deck of decks) {
              const m = statsRepo.getDeckMasteryStats(deck.id);
              agg.newCount += m.newCount;
              agg.learningCount += m.learningCount;
              agg.reviewCount += m.reviewCount;
              agg.relearnCount += m.relearnCount;
            }
            setDeckStats(ds);
            setFsrsStats(agg);

            // Load marginal gains data
            try {
              const accuracyHistory = statsRepo.getAccuracyHistory(14);
              const speedHistory = statsRepo.getResponseTimeHistory(14);
              if (accuracyHistory.length > 0) {
                setAccuracyTrend(calculateTrend(accuracyHistory, true));
              } else {
                setAccuracyTrend(undefined);
              }
              if (speedHistory.length > 0) {
                setSpeedTrend(calculateTrend(speedHistory, false));
              } else {
                setSpeedTrend(undefined);
              }
            } catch {
              setAccuracyTrend(undefined);
              setSpeedTrend(undefined);
            }

            setScreen("stats");
          } catch {
            // ignore
          }
          break;
        }
        case "decks": {
          try {
            const db = getDatabase();
            const cardRepo = new CardRepository(db);
            const statsRepo = new StatsRepository(db);
            const allDecks = cardRepo.getAllDecks();
            const infos = allDecks.map((deck) => ({
              deck,
              cardCount: cardRepo.getCardCount(deck.id),
              dueCount: statsRepo.getDueCardIds(deck.id).length,
              suspendedCount: statsRepo.getSuspendedCount(deck.id),
            }));
            setDeckData(infos);
            setScreen("decks");
          } catch {
            // ignore
          }
          break;
        }
        case "achievements": {
          try {
            const db = getDatabase();
            const achievementRepo = new AchievementRepository(db);
            setUnlockedAchievementKeys(achievementRepo.getUnlockedKeys());
            setScreen("achievements");
          } catch {
            // ignore
          }
          break;
        }
        case "daily_challenge": {
          if (!player) break;
          try {
            const db = getDatabase();
            const cardRepo = new CardRepository(db);
            const allCards = cardRepo.getAllCards();
            const seed = getDailySeed();
            const config = generateDailyChallenge(seed, allCards, player.level);
            setDailyChallengeConfig(config);
            setScreen("daily_challenge");
          } catch {
            // ignore
          }
          break;
        }
        case "dungeon": {
          if (!player) break;
          // Initialize a fresh dungeon run state when entering from hub
          setDungeonRunState(createDungeonRun(player.hp, player.maxHp));
          setDungeonFloorCombatResult(null);
          setScreen("dungeon");
          break;
        }
        case "create_cards": {
          try {
            const db = getDatabase();
            const cardRepo = new CardRepository(db);
            setCardCreatorDecks(cardRepo.getAllDecks());
            setScreen("create_cards");
          } catch {
            // ignore
          }
          break;
        }
        case "import": {
          // Import is CLI-only (ror import <file>)
          break;
        }
        default:
          setScreen(target as Screen);
      }
    },
    [player, prepareCombat],
  );

  const handleCombatComplete = useCallback(
    (result: CombatResult) => {
      if (!player) return;
      try {
        const db = getDatabase();
        const playerRepo = new PlayerRepository(db);
        const statsRepo = new StatsRepository(db);
        const equipRepo = new EquipmentRepository(db);

        // Update streak
        const today = getTodayUTC();
        const streakResult = updateStreak(player, today);
        let updated = streakResult.player;

        // Compute retention multiplier bonus for combat cards
        let combatRetentionXpBonus = 0;
        let combatRetentionGoldBonus = 0;
        if (result.victory) {
          const reviewedCards = combatCards.slice(0, result.cardsReviewed);
          for (const card of reviewedCards) {
            const existing = statsRepo.getSchedule(card.id);
            if (existing?.lastReview) {
              const daysSince = (Date.now() - new Date(existing.lastReview).getTime()) / (1000 * 60 * 60 * 24);
              const mult = getRetentionMultiplier(daysSince);
              if (mult > 1) {
                // Apply retention multiplier as bonus portion on top of base per-card share
                const perCardXp = result.cardsReviewed > 0 ? result.xpEarned / result.cardsReviewed : 0;
                const perCardGold = result.cardsReviewed > 0 ? result.goldEarned / result.cardsReviewed : 0;
                combatRetentionXpBonus += Math.floor(perCardXp * (mult - 1));
                combatRetentionGoldBonus += Math.floor(perCardGold * (mult - 1));
              }
            }
          }
        }

        // Update combat record
        updated = {
          ...updated,
          combatWins: updated.combatWins + (result.victory ? 1 : 0),
          combatLosses: updated.combatLosses + (result.victory ? 0 : 1),
          xp: updated.xp + result.xpEarned + combatRetentionXpBonus,
          gold: updated.gold + result.goldEarned + combatRetentionGoldBonus,
          totalReviews: updated.totalReviews + result.cardsReviewed,
          totalCorrect:
            updated.totalCorrect + result.perfectCount + result.correctCount,
        };

        // Apply level ups
        updated = applyLevelUp(updated);

        playerRepo.updatePlayer(updated);
        setPlayer(updated);

        // Save loot
        if (result.loot) {
          equipRepo.addEquipment(result.loot);
          equipRepo.addToInventory(result.loot.id);
        }

        // Update FSRS schedules for reviewed cards
        const quality = result.victory
          ? AnswerQuality.Correct
          : AnswerQuality.Wrong;
        for (const card of combatCards.slice(0, result.cardsReviewed)) {
          const existing = statsRepo.getSchedule(card.id);
          const schedule: ScheduleData = existing ?? createInitialSchedule(card.id);
          const updatedSchedule = updateSchedule(schedule, quality, undefined, player?.desiredRetention);

          // Compute evolution tier
          const evoStats = statsRepo.getCardEvolutionStats(card.id);
          const newConsecutive = result.victory ? evoStats.consecutiveCorrect + 1 : 0;
          const tier = evaluateEvolutionTier(
            newConsecutive,
            evoStats.currentTier as EvolutionTier,
            updatedSchedule.state,
            updatedSchedule.stability,
            evoStats.lapses,
          );

          statsRepo.recordAttempt(
            card.id,
            {
              cardId: card.id,
              timestamp: Date.now(),
              responseTime: 0,
              quality,
              wasTimed: false,
            },
            updatedSchedule,
            tier,
          );

          // Try to award a rare card variant on Perfect answers
          if ((quality as AnswerQuality) === AnswerQuality.Perfect) {
            const currentVariant = statsRepo.getCardVariant(card.id);
            const variant = tryAwardVariant(
              newConsecutive,
              currentVariant as any,
            );
            if (variant) {
              statsRepo.awardVariant(card.id, variant);
            }
          }
        }

        checkAchievements(updated);
        refreshCardsDue();
        sessionCardsReviewed.current += result.cardsReviewed;

        // Check if we should show the break screen (hard threshold, between screens)
        const combatBreakLevel = getBreakLevel(sessionStartMs, Date.now());
        if (combatBreakLevel === "hard" && !breakDismissed && !isBreakSuppressed()) {
          setBreakLevel(combatBreakLevel);
          setShowBreakScreen(true);
        }

        // If this was a dungeon floor combat, route results back to dungeon
        if (isDungeonFloor) {
          setIsDungeonFloor(false);
          setDungeonCombatStartHp(undefined);
          setDungeonFloorCombatResult({
            victory: result.victory,
            goldEarned: result.goldEarned,
            xpEarned: result.xpEarned,
            hpRemaining: result.playerHpRemaining,
          });
          setScreen("dungeon");
          return;
        }

        // 30% chance of random event after victory
        if (result.victory) {
          const hpPct = (updated.hp / updated.maxHp) * 100;
          const event = rollForEvent(hpPct);
          if (event) {
            setRandomEvent(event);
            setEventOutcome(null);
            setScreen("random_event");
            return;
          }
        }

        setScreen("hub");
      } catch (err: any) {
        console.error("Error saving combat results:", err.message);
        if (isDungeonFloor) {
          setIsDungeonFloor(false);
          setDungeonFloorCombatResult({
            victory: false,
            goldEarned: 0,
            xpEarned: 0,
            hpRemaining: player?.hp ?? 0,
          });
          setScreen("dungeon");
        } else {
          setScreen("hub");
        }
      }
    },
    [player, combatCards, refreshCardsDue, checkAchievements, isDungeonFloor],
  );

  const handleReviewComplete = useCallback(
    (results: ReviewResult[]) => {
      if (!player) return;
      try {
        const db = getDatabase();
        const playerRepo = new PlayerRepository(db);
        const statsRepo = new StatsRepository(db);

        // Update streak
        const today = getTodayUTC();
        const streakResult = updateStreak(player, today);
        let updated = streakResult.player;

        // Count correct answers
        const correctCount = results.filter(
          (r) =>
            r.quality === AnswerQuality.Perfect ||
            r.quality === AnswerQuality.Correct ||
            r.quality === AnswerQuality.Partial,
        ).length;

        updated = {
          ...updated,
          totalReviews: updated.totalReviews + results.length,
          totalCorrect: updated.totalCorrect + correctCount,
        };

        // Update each card's FSRS schedule and compute retention bonuses
        const bonusCards: { cardId: string; multiplier: number }[] = [];
        const earnedVariants: Array<{ cardId: string; variant: "foil" | "golden" | "prismatic" }> = [];
        let retentionXpBonus = 0;
        for (const result of results) {
          const existing = statsRepo.getSchedule(result.cardId);
          const schedule: ScheduleData =
            existing ?? createInitialSchedule(result.cardId);

          // Compute retention multiplier from days since last review (before updating)
          const isCorrect =
            result.quality === AnswerQuality.Perfect ||
            result.quality === AnswerQuality.Correct ||
            result.quality === AnswerQuality.Partial;
          if (isCorrect && existing?.lastReview) {
            const daysSince = (Date.now() - new Date(existing.lastReview).getTime()) / (1000 * 60 * 60 * 24);
            const mult = getRetentionMultiplier(daysSince);
            if (mult > 1) {
              bonusCards.push({ cardId: result.cardId, multiplier: mult });
              // Each card earns 5 base XP; bonus is (mult - 1) * 5 extra XP
              retentionXpBonus += (mult - 1) * 5;
            }
          }

          const updatedSchedule = updateSchedule(
            schedule,
            result.quality,
            result.confidence,
            player?.desiredRetention,
          );

          // Compute evolution tier
          const evoStats = statsRepo.getCardEvolutionStats(result.cardId);
          const newConsecutive = isCorrect ? evoStats.consecutiveCorrect + 1 : 0;
          const tier = evaluateEvolutionTier(
            newConsecutive,
            evoStats.currentTier as EvolutionTier,
            updatedSchedule.state,
            updatedSchedule.stability,
            evoStats.lapses,
          );

          statsRepo.recordAttempt(
            result.cardId,
            {
              cardId: result.cardId,
              timestamp: Date.now(),
              responseTime: result.responseTime,
              quality: result.quality,
              wasTimed: false,
              confidence: result.confidence,
              retrievalMode: result.retrievalMode,
              responseText: result.responseText,
            },
            updatedSchedule,
            tier,
          );

          // Try to award a rare card variant on Perfect answers
          if (result.quality === AnswerQuality.Perfect) {
            const currentVariant = statsRepo.getCardVariant(result.cardId);
            const variant = tryAwardVariant(
              newConsecutive,
              currentVariant as any,
            );
            if (variant) {
              statsRepo.awardVariant(result.cardId, variant);
              earnedVariants.push({ cardId: result.cardId, variant: variant as "foil" | "golden" | "prismatic" });
            }
          }
        }

        // Award XP for reviewing (Deep Focus perk: +10%) plus retention bonus
        const baseReviewXp = results.length * 5 + retentionXpBonus;
        const xpGained = hasPerk(updated.wisdomXp, "deep_focus")
          ? Math.floor(baseReviewXp * 1.1)
          : baseReviewXp;
        updated = { ...updated, xp: updated.xp + xpGained };

        // Award bonus Wisdom XP for elaborative interrogation explanations (15 per explanation)
        const elaborationCount = results.filter((r) => r.elaborationText).length;
        if (elaborationCount > 0) {
          const elaborationWisdomXp = elaborationCount * 15;
          updated = { ...updated, wisdomXp: updated.wisdomXp + elaborationWisdomXp };
        }

        const prevLevel = updated.level;
        updated = applyLevelUp(updated);

        playerRepo.updatePlayer(updated);
        setPlayer(updated);
        setReviewResults(results);
        setReviewXp(xpGained);
        setRetentionBonusCards(bonusCards);
        setSessionNewVariants(earnedVariants);
        const didLevelUp = updated.level > prevLevel;
        setLeveledUp(didLevelUp);
        setNewLevel(updated.level);
        if (didLevelUp) playBel();

        // Calculate reflection data
        const reviewAccuracy =
          results.length > 0 ? correctCount / results.length : 0;
        const cpjMessages = shouldShowCPJ(reviewAccuracy)
          ? generateCPJReframe(reviewAccuracy, [])
          : undefined;
        setReflectionAccuracy(reviewAccuracy);
        setReflectionCardsReviewed(results.length);
        setReflectionCpjMessages(cpjMessages);
        setReflectionShowJournal(shouldShowJournal());
        setReflectionPrompt(selectPrompt(null));
        setReflectionDeckId(undefined);

        refreshCardsDue();
        sessionCardsReviewed.current += results.length;

        // Check if we should show the break screen (hard threshold, between screens)
        const reviewBreakLevel = getBreakLevel(sessionStartMs, Date.now());
        if (reviewBreakLevel === "hard" && !breakDismissed && !isBreakSuppressed()) {
          setBreakLevel(reviewBreakLevel);
          setShowBreakScreen(true);
        }

        setScreen("review_summary");
      } catch (err: any) {
        console.error("Error saving review results:", err.message);
        setScreen("hub");
      }
    },
    [player, refreshCardsDue],
  );

  const handleWelcomeBackSelect = useCallback(
    (option: BacklogSessionOption) => {
      try {
        const db = getDatabase();
        const cardRepo = new CardRepository(db);
        const selectedIds = getBacklogSessionCardIds(option, backlogOverdueCardIds);
        const cards = selectedIds
          .map((id) => cardRepo.getCard(id))
          .filter((c): c is Card => c !== undefined);
        if (cards.length === 0) {
          setScreen("hub");
          return;
        }
        // Select retrieval mode for the catch-up review session
        const mode = selectMode("review", [], sessionModes);
        setCurrentRetrievalMode(mode);
        setSessionModes((prev) => [...prev, mode]);
        setCombatCards(cards);
        setReviewResults([]);
        setScreen("review");
      } catch {
        setScreen("hub");
      }
    },
    [backlogOverdueCardIds, sessionModes],
  );

  const handleReflectionComplete = useCallback(
    (result: {
      difficultyRating: 1 | 2 | 3;
      journalEntry?: string;
      wisdomXp: number;
    }) => {
      if (!player) return;
      try {
        const db = getDatabase();
        const reflectionRepo = new ReflectionRepository(db);
        const playerRepo = new PlayerRepository(db);

        // Save reflection
        reflectionRepo.saveReflection({
          id: `ref-${Date.now()}`,
          sessionType: "review",
          difficultyRating: result.difficultyRating,
          journalEntry: result.journalEntry,
          promptUsed: reflectionPrompt,
          accuracy: reflectionAccuracy,
          cardsReviewed: reflectionCardsReviewed,
          deckId: reflectionDeckId,
        });

        // Add wisdom XP to player
        const updated = {
          ...player,
          wisdomXp: player.wisdomXp + result.wisdomXp,
        };
        playerRepo.updatePlayer(updated);
        setPlayer(updated);

        refreshCardsDue();
        setScreen("hub");
      } catch (err: any) {
        console.error("Error saving reflection:", err.message);
        setScreen("hub");
      }
    },
    [
      player,
      reflectionAccuracy,
      reflectionCardsReviewed,
      reflectionPrompt,
      reflectionDeckId,
      refreshCardsDue,
    ],
  );

  const handleEquip = useCallback((inventoryId: number) => {
    try {
      const db = getDatabase();
      const equipRepo = new EquipmentRepository(db);
      equipRepo.equipItem(inventoryId);
      setEquippedItems(equipRepo.getEquipped());
      setInventoryData(
        equipRepo.getInventory() as Array<{
          equipment: Equipment;
          equipped: boolean;
          inventoryId: number;
        }>,
      );
    } catch {
      // ignore
    }
  }, []);

  const handleUnequip = useCallback((inventoryId: number) => {
    try {
      const db = getDatabase();
      const equipRepo = new EquipmentRepository(db);
      equipRepo.unequipItem(inventoryId);
      setEquippedItems(equipRepo.getEquipped());
      setInventoryData(
        equipRepo.getInventory() as Array<{
          equipment: Equipment;
          equipped: boolean;
          inventoryId: number;
        }>,
      );
    } catch {
      // ignore
    }
  }, []);

  const handleToggleDeck = useCallback(
    (deckId: string) => {
      try {
        const db = getDatabase();
        const cardRepo = new CardRepository(db);
        const statsRepo = new StatsRepository(db);
        cardRepo.toggleDeckEquipped(deckId);
        const allDecks = cardRepo.getAllDecks();
        const infos = allDecks.map((deck) => ({
          deck,
          cardCount: cardRepo.getCardCount(deck.id),
          dueCount: statsRepo.getDueCardIds(deck.id).length,
          suspendedCount: statsRepo.getSuspendedCount(deck.id),
        }));
        setDeckData(infos);
        refreshCardsDue();
      } catch {
        // ignore
      }
    },
    [refreshCardsDue],
  );

  const handleUnsuspendAll = useCallback(
    (deckId: string) => {
      try {
        const db = getDatabase();
        const cardRepo = new CardRepository(db);
        const statsRepo = new StatsRepository(db);
        statsRepo.unsuspendAll(deckId);
        const allDecks = cardRepo.getAllDecks();
        const infos = allDecks.map((deck) => ({
          deck,
          cardCount: cardRepo.getCardCount(deck.id),
          dueCount: statsRepo.getDueCardIds(deck.id).length,
          suspendedCount: statsRepo.getSuspendedCount(deck.id),
        }));
        setDeckData(infos);
        refreshCardsDue();
      } catch {
        // ignore
      }
    },
    [refreshCardsDue],
  );

  const handleSelectZone = useCallback(
    (zoneId: string) => {
      if (!player) return;
      try {
        const db = getDatabase();
        const zoneRepo = new ZoneRepository(db);
        const zone = zoneRepo.getZones().find((z) => z.id === zoneId);
        if (!zone) return;
        if (prepareCombat(zone.deckId)) {
          setScreen("combat");
        }
      } catch {
        // ignore
      }
    },
    [player, prepareCombat],
  );

  // Global keyboard shortcuts
  useInput((input, key) => {
    if (
      screen === "title" ||
      screen === "welcome_back" ||
      screen === "combat" ||
      screen === "review" ||
      screen === "reflection" ||
      screen === "dungeon" ||
      screen === "random_event" ||
      screen === "create_cards"
    )
      return;
    if (input === "q") {
      exit();
      return;
    }
    if (key.return && screen === "review_summary") {
      setScreen("reflection");
      return;
    }
    if (key.escape && screen !== "hub") {
      setScreen("hub");
    }
  });

  const terminalHeight = process.stdout.rows || 24;
  const today = getTodayUTC();
  const streakAtRisk = player ? isStreakAtRisk(player, today) : false;
  const streakBonusPct = player ? getStreakBonus(player.streakDays) : 0;

  const renderContent = () => {
    switch (screen) {
      case "title":
        return <TitleScreen onCreatePlayer={handleCreatePlayer} />;
      case "hub":
        return (
          <HubScreen
            cardsDue={cardsDue}
            streakAtRisk={streakAtRisk}
            newCardsRemaining={newCardsRemaining}
            idleBanner={idleBanner}
            onNavigate={navigateToScreen}
          />
        );
      case "welcome_back":
        return (
          <WelcomeBackScreen
            daysSinceLastReview={backlogDaysSince}
            overdueCount={backlogOverdueCount}
            onSelectOption={handleWelcomeBackSelect}
          />
        );
      case "combat":
        return combatEnemy && player ? (
          <CombatScreen
            cards={combatCards}
            enemy={combatEnemy}
            player={player}
            equippedItems={equippedItems}
            streakBonusPct={streakBonusPct}
            combatSettings={combatSettings}
            retrievalMode={currentRetrievalMode}
            startingHpOverride={isDungeonFloor ? dungeonCombatStartHp : undefined}
            isDungeonFloor={isDungeonFloor}
            onRetreat={() => setScreen("hub")}
            onComplete={handleCombatComplete}
          />
        ) : (
          <Text>Loading combat...</Text>
        );
      case "review":
        return (
          <ReviewScreen
            cards={combatCards}
            onComplete={handleReviewComplete}
            mode={currentRetrievalMode}
            timerSeconds={applyAscensionToCombat(
              { ...getDefaultCombatSettings(), timerSeconds: player?.timerSeconds ?? 30 },
              player?.ascensionLevel ?? 0,
            ).timerSeconds}
          />
        );
      case "review_summary":
        return (
          <Box flexDirection="column">
            <ReviewSummary
              results={reviewResults}
              xpEarned={reviewXp}
              leveledUp={leveledUp}
              newLevel={newLevel}
              retentionBonusCards={retentionBonusCards}
              newVariants={sessionNewVariants}
            />
            <Box marginTop={1} justifyContent="center">
              <Text dimColor italic>
                Press Enter to continue...
              </Text>
            </Box>
          </Box>
        );
      case "reflection":
        return (
          <ReflectionScreen
            accuracy={reflectionAccuracy}
            cardsReviewed={reflectionCardsReviewed}
            cpjMessages={reflectionCpjMessages}
            showJournal={reflectionShowJournal}
            reflectionPrompt={reflectionPrompt}
            onComplete={handleReflectionComplete}
          />
        );
      case "inventory":
        return (
          <InventoryScreen
            equippedItems={equippedItems}
            inventory={inventoryData}
            onEquip={handleEquip}
            onUnequip={handleUnequip}
            onBack={() => setScreen("hub")}
          />
        );
      case "map":
        return (
          <MapScreen
            zones={zoneData}
            onSelectZone={handleSelectZone}
            onBack={() => setScreen("hub")}
            ascensionLevel={mapAscensionLevel}
            activeModifiers={getActiveModifiers(mapAscensionLevel)}
            canAscend={mapCanAscend}
            onAscend={() => {
              if (!player) return;
              try {
                const db = getDatabase();
                const playerRepo = new PlayerRepository(db);
                const updated = {
                  ...player,
                  ascensionLevel: player.ascensionLevel + 1,
                };
                playerRepo.updatePlayer(updated);
                setPlayer(updated);
                setMapAscensionLevel(updated.ascensionLevel);
                setMapCanAscend(false);
                checkAchievements(updated);
              } catch {
                // ignore
              }
            }}
          />
        );
      case "decks":
        return (
          <DeckScreen
            decks={deckData}
            onToggle={handleToggleDeck}
            onUnsuspendAll={handleUnsuspendAll}
            onBack={() => setScreen("hub")}
          />
        );
      case "stats":
        return player ? (
          <StatsScreen
            player={player}
            deckStats={deckStats}
            fsrsStats={fsrsStats}
            onBack={() => setScreen("hub")}
            onUpdateRetention={(retention: number) => {
              try {
                const db = getDatabase();
                const playerRepo = new PlayerRepository(db);
                const updated = { ...player, desiredRetention: retention };
                playerRepo.updatePlayer(updated);
                setPlayer(updated);
              } catch {
                // ignore
              }
            }}
            onUpdateMaxNewCards={(maxNewCards: number) => {
              try {
                const db = getDatabase();
                const playerRepo = new PlayerRepository(db);
                const updated = { ...player, maxNewCardsPerDay: maxNewCards };
                playerRepo.updatePlayer(updated);
                setPlayer(updated);
                refreshCardsDue();
              } catch {
                // ignore
              }
            }}
            onUpdateTimer={(timerSeconds: number) => {
              try {
                const db = getDatabase();
                const playerRepo = new PlayerRepository(db);
                const updated = { ...player, timerSeconds };
                playerRepo.updatePlayer(updated);
                setPlayer(updated);
              } catch {
                // ignore
              }
            }}
            accuracyTrend={accuracyTrend}
            speedTrend={speedTrend}
            wisdomXp={player.wisdomXp}
            variantCounts={(() => {
              try {
                const db = getDatabase();
                const statsRepo = new StatsRepository(db);
                return statsRepo.getVariantCounts();
              } catch {
                return undefined;
              }
            })()}
          />
        ) : null;
      case "achievements":
        return (
          <AchievementScreen
            unlockedKeys={unlockedAchievementKeys}
            onBack={() => setScreen("hub")}
          />
        );
      case "daily_challenge":
        return player && dailyChallengeConfig ? (
          <DailyChallengeScreen
            config={dailyChallengeConfig}
            alreadyCompleted={player.dailyChallengeCompleted}
            previousScore={player.dailyChallengeScore}
            onStartChallenge={() => {
              // Prepare combat with daily challenge cards and enemy
              if (!player) return;
              try {
                const db = getDatabase();
                const cardRepo = new CardRepository(db);
                const cards = dailyChallengeConfig.cardIds
                  .map((id) => cardRepo.getCard(id))
                  .filter((c): c is Card => c !== undefined);
                if (cards.length === 0) return;
                setCombatCards(cards);
                setCombatEnemy(dailyChallengeConfig.enemy);
                const equipRepo = new EquipmentRepository(db);
                setEquippedItems(equipRepo.getEquipped());
                setScreen("combat");
              } catch {
                // ignore
              }
            }}
            onBack={() => setScreen("hub")}
          />
        ) : null;
      case "dungeon":
        return player ? (
          <DungeonRunScreen
            playerHp={player.hp}
            playerMaxHp={player.maxHp}
            playerLevel={player.level}
            initialRunState={dungeonRunState}
            floorCombatResult={dungeonFloorCombatResult}
            onRunStateChange={(state) => setDungeonRunState(state)}
            onFloorCombat={(floorNumber: number) => {
              if (!player) return;
              // Build a temporary run state to get the floor config
              const tempRun = { ...(dungeonRunState ?? createDungeonRun(player.hp, player.maxHp)), currentFloor: floorNumber };
              const floorConfig = getCurrentFloorConfig(tempRun);

              // Use dungeon run HP for combat starting HP
              const dungeonHp = dungeonRunState?.playerHp ?? player.hp;

              // Prepare combat cards and enemy scaled for this floor
              if (prepareCombat()) {
                // Scale the enemy by the floor's HP multiplier using functional update
                // since prepareCombat just called setCombatEnemy
                setCombatEnemy((prev) => prev ? scaleEnemyForFloor(prev, floorConfig) : prev);
                setIsDungeonFloor(true);
                setDungeonCombatStartHp(dungeonHp);
                setDungeonFloorCombatResult(null);
                setScreen("combat");
              }
            }}
            onComplete={(result) => {
              if (!player) return;
              try {
                const db = getDatabase();
                const playerRepo = new PlayerRepository(db);
                const updated = {
                  ...player,
                  gold: player.gold + result.gold,
                  xp: player.xp + result.xp,
                };
                const leveled = applyLevelUp(updated);
                playerRepo.updatePlayer(leveled);
                setPlayer(leveled);
                checkAchievements(leveled);
                refreshCardsDue();
              } catch {
                // ignore
              }
              setScreen("hub");
            }}
            onBack={() => setScreen("hub")}
          />
        ) : null;
      case "random_event":
        return randomEvent && player ? (
          <RandomEventScreen
            event={randomEvent}
            playerLevel={player.level}
            playerMaxHp={player.maxHp}
            onComplete={(outcome) => {
              if (!player) return;
              try {
                const db = getDatabase();
                const playerRepo = new PlayerRepository(db);
                const updated = {
                  ...player,
                  gold: Math.max(0, player.gold + outcome.goldChange),
                  hp: Math.min(player.maxHp, Math.max(0, player.hp + outcome.hpChange)),
                  xp: player.xp + Math.max(0, outcome.xpChange),
                  wisdomXp: player.wisdomXp + outcome.wisdomXpChange,
                };
                const leveled = applyLevelUp(updated);
                playerRepo.updatePlayer(leveled);
                setPlayer(leveled);
              } catch {
                // ignore
              }
              setRandomEvent(null);
              setEventOutcome(null);
              setScreen("hub");
            }}
          />
        ) : null;
      case "create_cards":
        return (
          <CardCreatorScreen
            decks={cardCreatorDecks}
            onCreateCard={(cardData) => {
              try {
                const db = getDatabase();
                const cardRepo = new CardRepository(db);
                const cardId = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                cardRepo.insertCard({
                  id: cardId,
                  front: cardData.front,
                  back: cardData.back,
                  acceptableAnswers: cardData.acceptableAnswers,
                  type: cardData.isCloze ? CardType.ClozeDeletion : CardType.Basic,
                  deckId: cardData.deckId,
                });
                refreshCardsDue();
              } catch {
                // ignore
              }
            }}
            onCreateDeck={(name) => {
              const deckId = `deck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              try {
                const db = getDatabase();
                const cardRepo = new CardRepository(db);
                cardRepo.createDeck({
                  id: deckId,
                  name,
                  description: "",
                  createdAt: new Date().toISOString(),
                  equipped: true,
                });
                setCardCreatorDecks(cardRepo.getAllDecks());
              } catch {
                // ignore
              }
              return deckId;
            }}
            onBack={() => {
              refreshCardsDue();
              setScreen("hub");
            }}
          />
        );
      default:
        return <Text>Unknown screen</Text>;
    }
  };

  return (
    <ThemeProvider>
      <NavigationContext.Provider
        value={{ navigate: navigateToScreen as (screen: Screen) => void, currentScreen: screen }}
      >
        <Box flexDirection="column" minHeight={terminalHeight}>
          {player && screen !== "title" && (
            <Header
              playerName={player.name}
              streakDays={player.streakDays}
              dayCount={player.totalReviews}
              streakAtRisk={streakAtRisk}
            />
          )}
          <Box flexGrow={1}>
            {showBreakScreen && !isBreakSuppressed() ? (
              <BreakSuggestion
                sessionElapsedMs={Date.now() - sessionStartMs}
                cardsReviewed={sessionCardsReviewed.current}
                onDismiss={() => {
                  setShowBreakScreen(false);
                  setBreakDismissed(true);
                }}
                onReturnToHub={() => {
                  setShowBreakScreen(false);
                  setBreakDismissed(true);
                  setScreen("hub");
                }}
              />
            ) : (
              renderContent()
            )}
          </Box>
          {player && screen !== "title" && (
            <StatusBar
              player={player}
              cardsDue={cardsDue}
              breakWarning={
                breakLevel === "soft" && !breakDismissed && !isBreakSuppressed()
                  ? getBreakMessage("soft")
                  : undefined
              }
            />
          )}
        </Box>
      </NavigationContext.Provider>
    </ThemeProvider>
  );
}
