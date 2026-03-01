import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { ThemeProvider } from "./ThemeProvider.js";
import { Header } from "./Header.js";
import { StatusBar } from "./StatusBar.js";
import { TitleScreen } from "../screens/TitleScreen.js";
import { HubScreen } from "../screens/HubScreen.js";
import { CombatScreen } from "../screens/CombatScreen.js";
import { InventoryScreen } from "../screens/InventoryScreen.js";
import { MapScreen } from "../screens/MapScreen.js";
import { StatsScreen } from "../screens/StatsScreen.js";
import { DeckScreen } from "../screens/DeckScreen.js";
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
import {
  calculateTrend,
} from "../../core/analytics/MarginalGains.js";
import { checkNewAchievements } from "../../core/progression/Achievements.js";
import type { AchievementState } from "../../core/progression/Achievements.js";
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
import { AnswerQuality, PlayerClass, RetrievalMode } from "../../types/index.js";
import type { CombatResult } from "../../types/combat.js";
import type { Enemy } from "../../types/combat.js";
import type { TrendResult } from "../../core/analytics/MarginalGains.js";

export type Screen =
  | "title"
  | "hub"
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
  | "random_event";

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
    Array<{ deck: Deck; cardCount: number; dueCount: number }>
  >([]);
  const [reviewResults, setReviewResults] = useState<ReviewResult[]>([]);
  const [reviewXp, setReviewXp] = useState(0);
  const [leveledUp, setLeveledUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);

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
        setPlayer(p);
        setScreen("hub");
        const cardRepo = new CardRepository(db);
        const statsRepo = new StatsRepository(db);
        const equippedIds = cardRepo.getEquippedDeckIds();
        const maxNew = p.maxNewCardsPerDay ?? 20;
        const { cardIds, newCardsRemaining: remaining } = statsRepo.getDueCardsWithNewLimit(equippedIds, maxNew, 9999);
        setCardsDue(cardIds.length);
        setNewCardsRemaining(remaining);
      }
    } catch {
      // ignore — show title screen
    }
  }, []);

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

        // Apply ascension modifiers to combat settings
        const settings = applyAscensionToCombat(getDefaultCombatSettings(), player.ascensionLevel);

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
        let updated = updateStreak(player, today);

        // Update combat record
        updated = {
          ...updated,
          combatWins: updated.combatWins + (result.victory ? 1 : 0),
          combatLosses: updated.combatLosses + (result.victory ? 0 : 1),
          xp: updated.xp + result.xpEarned,
          gold: updated.gold + result.goldEarned,
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
        }

        checkAchievements(updated);
        refreshCardsDue();

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
        let updated = updateStreak(player, today);

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

        // Update each card's FSRS schedule
        for (const result of results) {
          const existing = statsRepo.getSchedule(result.cardId);
          const schedule: ScheduleData =
            existing ?? createInitialSchedule(result.cardId);
          const updatedSchedule = updateSchedule(
            schedule,
            result.quality,
            result.confidence,
            player?.desiredRetention,
          );

          // Compute evolution tier
          const evoStats = statsRepo.getCardEvolutionStats(result.cardId);
          const isCorrect =
            result.quality === AnswerQuality.Perfect ||
            result.quality === AnswerQuality.Correct ||
            result.quality === AnswerQuality.Partial;
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
        }

        // Award XP for reviewing
        const xpGained = results.length * 5;
        updated = { ...updated, xp: updated.xp + xpGained };

        const prevLevel = updated.level;
        updated = applyLevelUp(updated);

        playerRepo.updatePlayer(updated);
        setPlayer(updated);
        setReviewResults(results);
        setReviewXp(xpGained);
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
        setScreen("review_summary");
      } catch (err: any) {
        console.error("Error saving review results:", err.message);
        setScreen("hub");
      }
    },
    [player, refreshCardsDue],
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
      screen === "combat" ||
      screen === "review" ||
      screen === "reflection" ||
      screen === "dungeon" ||
      screen === "random_event"
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
            onNavigate={navigateToScreen}
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
            accuracyTrend={accuracyTrend}
            speedTrend={speedTrend}
            wisdomXp={player.wisdomXp}
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
          <Box flexGrow={1}>{renderContent()}</Box>
          {player && screen !== "title" && (
            <StatusBar player={player} cardsDue={cardsDue} />
          )}
        </Box>
      </NavigationContext.Provider>
    </ThemeProvider>
  );
}
