import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { Card, CombatResult, Equipment } from "../../types/index.js";
import { AnswerQuality, RetrievalMode } from "../../types/index.js";
import type { Enemy, CombatCardResult } from "../../types/combat.js";
import type { Player } from "../../types/player.js";
import {
  createCombatState,
  resolveTurn,
  isCombatOver,
  getCombatRewards,
  parseEquipmentEffects,
} from "../../core/combat/CombatEngine.js";
import type { CombatState } from "../../core/combat/CombatEngine.js";
import { QualityFeedback } from "../shared/QualityFeedback.js";
import { rollLoot } from "../../core/combat/LootTable.js";
import { evaluateAnswer } from "../../core/cards/CardEvaluator.js";
import { generatePartialCue } from "../../core/cards/HintGenerator.js";
import { getBossPhases, getCurrentPhase, hasPhaseChanged, isBossEnemy } from "../../core/combat/BossPhases.js";
import type { BossPhase } from "../../core/combat/BossPhases.js";
import { getEffectiveStats } from "../../core/player/PlayerStats.js";
import { EnemyDisplay } from "../combat/EnemyDisplay.js";
import { EncounterPreview } from "../combat/EncounterPreview.js";
import { CombatLog } from "../combat/CombatLog.js";
import { LootDrop } from "../combat/LootDrop.js";
import { DamageNumber } from "../combat/DamageNumber.js";
import { FlashcardFace } from "../review/FlashcardFace.js";
import { useGameTheme } from "../app/ThemeProvider.js";
import { ReflectionScreen } from "../review/ReflectionScreen.js";
import { selectLore } from "../../core/narrative/LoreFragments.js";
import type { LoreFragment } from "../../core/narrative/LoreFragments.js";
import { getDatabase } from "../../data/database.js";
import { StatsRepository } from "../../data/repositories/StatsRepository.js";
import { CardRepository } from "../../data/repositories/CardRepository.js";
import type { EvolutionTier, CardHealthStatus } from "../../core/cards/CardEvolution.js";
import { getCardHealth } from "../../core/cards/CardEvolution.js";
import {
  selectPrompt,
  shouldShowJournal,
  generateCPJReframe,
  shouldShowCPJ,
} from "../../core/reflection/ReflectionEngine.js";
import {
  getUnlockedAbilities,
  canUseAbility,
  getAbilityEffect,
  tickCooldowns,
} from "../../core/player/ClassAbilities.js";
import type { ClassAbility, ActiveAbility, AbilityEffect } from "../../core/player/ClassAbilities.js";
import type { CombatSettings } from "../../core/progression/AscensionSystem.js";
import { calculateWagerResult, WAGER_LABELS } from "../../core/combat/WagerSystem.js";
import type { WagerLevel, WagerResult } from "../../core/combat/WagerSystem.js";

type Phase = "encounter_preview" | "intro" | "card" | "wager" | "resolve" | "result" | "reflection" | "ability_menu";

interface Props {
  cards: Card[];
  enemy: Enemy;
  player: Player;
  equippedItems: Equipment[];
  streakBonusPct: number;
  combatSettings?: CombatSettings;
  retrievalMode?: RetrievalMode;
  startingHpOverride?: number;
  isDungeonFloor?: boolean;
  seenLoreIds?: Set<number>;
  onLoreSeen?: (id: number) => void;
  onRetreat?: () => void;
  onComplete: (result: CombatResult) => void;
}

export function CombatScreen({
  cards,
  enemy,
  player,
  equippedItems,
  streakBonusPct,
  combatSettings,
  retrievalMode,
  startingHpOverride,
  isDungeonFloor,
  seenLoreIds,
  onLoreSeen,
  onRetreat,
  onComplete,
}: Props) {
  const theme = useGameTheme();
  const stats = getEffectiveStats(player, equippedItems);
  const parsedEffects = useMemo(() => parseEquipmentEffects(equippedItems), [equippedItems]);

  const [phase, setPhase] = useState<Phase>("encounter_preview");
  const [combat, setCombat] = useState<CombatState>(() => {
    // Use override HP (e.g., from dungeon floor) if provided, else use player HP
    const baseHp = startingHpOverride ?? player.hp;
    // Apply startingHpPercent from ascension settings
    const startHpPct = combatSettings?.startingHpPercent ?? 100;
    const startingHp = startHpPct < 100
      ? Math.max(1, Math.floor(baseHp * (startHpPct / 100)))
      : baseHp;
    const state = createCombatState(enemy, stats.maxHp, startingHp, cards.length);
    // Apply ascension poison damage per turn
    if (combatSettings?.enemyPoisonDamage && combatSettings.enemyPoisonDamage > 0) {
      state.poisonDamage = combatSettings.enemyPoisonDamage;
    }
    return state;
  });
  // Successive relearning: mutable card queue and re-queue tracking
  const MAX_REQUEUES = 2;
  const [cardQueue, setCardQueue] = useState<Card[]>(() => [...cards]);
  const [requeueCounts, setRequeueCounts] = useState<Map<string, number>>(
    () => new Map(),
  );

  const [input, setInput] = useState("");
  const [cardStart, setCardStart] = useState(Date.now());
  const [lastQuality, setLastQuality] = useState<AnswerQuality | null>(null);
  const [lastDamage, setLastDamage] = useState<number | null>(null);
  const [lastDamageType, setLastDamageType] = useState<
    "dealt" | "received" | "critical"
  >("dealt");
  const [loot, setLoot] = useState<Equipment | null>(null);
  const [rewards, setRewards] = useState<{ xp: number; gold: number } | null>(
    null,
  );
  const [victory, setVictory] = useState(false);
  const [lootDismissed, setLootDismissed] = useState(false);
  const [combatResult, setCombatResult] = useState<CombatResult | null>(null);

  // Per-card answer quality tracking for FSRS scheduling
  const [cardResults, setCardResults] = useState<CombatCardResult[]>([]);

  // Ability state
  const [currentSp, setCurrentSp] = useState(player.skillPoints);
  const [activeAbilities, setActiveAbilities] = useState<ActiveAbility[]>([]);
  const [activeEffects, setActiveEffects] = useState<AbilityEffect[]>([]);
  const [abilityMessage, setAbilityMessage] = useState<string | null>(null);
  const unlockedAbilities = getUnlockedAbilities(player.class, player.level);
  // Boss phase tracking
  const bossPhases = useMemo(() => {
    if (!isBossEnemy(enemy.tier)) return null;
    return getBossPhases(enemy.name);
  }, [enemy.name, enemy.tier]);
  const [currentBossPhase, setCurrentBossPhase] = useState<BossPhase | null>(() => {
    if (!bossPhases) return null;
    return getCurrentPhase(bossPhases, 1.0);
  });
  const [phaseTransitionMsg, setPhaseTransitionMsg] = useState<string | null>(null);
  // Wager state
  const [currentWager, setCurrentWager] = useState<WagerLevel>("none");
  const [wagerResults, setWagerResults] = useState<WagerResult[]>([]);
  const [lastWagerResult, setLastWagerResult] = useState<WagerResult | null>(null);
  // Suspend/bury confirmation
  const [cardActionMsg, setCardActionMsg] = useState<string | null>(null);
  // Undo support: snapshot of combat state before last answer
  const [preAnswerSnapshot, setPreAnswerSnapshot] = useState<{
    combat: CombatState;
    cardQueue: Card[];
    requeueCounts: Map<string, number>;
    activeEffects: AbilityEffect[];
    activeAbilities: ActiveAbility[];
    currentSp: number;
  } | null>(null);
  const [undoUsed, setUndoUsed] = useState(false);
  const [undoMsg, setUndoMsg] = useState<string | null>(null);

  // Lore fragment shown on defeat
  const [defeatLore, setDefeatLore] = useState<LoreFragment | null>(null);

  // Look up evolution tiers for all cards
  const cardTiers = useMemo(() => {
    try {
      const db = getDatabase();
      const statsRepo = new StatsRepository(db);
      const tiers = new Map<string, number>();
      for (const c of cards) {
        tiers.set(c.id, statsRepo.getCardEvolutionTier(c.id));
      }
      return tiers;
    } catch {
      return new Map<string, number>();
    }
  }, [cards]);

  // Look up card health status for all cards
  const cardHealthMap = useMemo(() => {
    try {
      const db = getDatabase();
      const statsRepo = new StatsRepository(db);
      const healthMap = new Map<string, CardHealthStatus>();
      for (const c of cards) {
        const { recentQualities, totalLapses } = statsRepo.getCardHealthData(c.id);
        healthMap.set(c.id, getCardHealth(recentQualities, totalLapses));
      }
      return healthMap;
    } catch {
      return new Map<string, CardHealthStatus>();
    }
  }, [cards]);

  // Look up card variants for all cards
  const cardVariants = useMemo(() => {
    try {
      const db = getDatabase();
      const statsRepo = new StatsRepository(db);
      const variants = new Map<string, string | null>();
      for (const c of cards) {
        variants.set(c.id, statsRepo.getCardVariant(c.id));
      }
      return variants;
    } catch {
      return new Map<string, string | null>();
    }
  }, [cards]);

  // Compute encounter preview data
  const previewData = useMemo(() => {
    try {
      const db = getDatabase();
      const statsRepo = new StatsRepository(db);
      const cardRepo = new CardRepository(db);

      // Average card difficulty from due cards
      let totalDifficulty = 0;
      let difficultyCount = 0;
      for (const c of cards) {
        const schedule = statsRepo.getSchedule(c.id);
        if (schedule) {
          totalDifficulty += schedule.difficulty;
          difficultyCount++;
        }
      }
      const avgDifficulty = difficultyCount > 0 ? totalDifficulty / difficultyCount : 5;

      // Deck/topic names
      const deckIds = new Set(cards.map((c) => c.deckId));
      const deckNames: string[] = [];
      for (const did of deckIds) {
        const deck = cardRepo.getDeck(did);
        if (deck) deckNames.push(deck.name);
      }

      return {
        avgDifficulty: Math.round(avgDifficulty * 10) / 10,
        deckNames: deckNames.length > 0 ? deckNames.join(", ") : "Mixed",
        xpReward: enemy.xpReward,
        goldReward: enemy.goldReward,
      };
    } catch {
      return {
        avgDifficulty: 5,
        deckNames: "Unknown",
        xpReward: enemy.xpReward,
        goldReward: enemy.goldReward,
      };
    }
  }, [cards, enemy]);

  const currentCard = cardQueue[combat.currentCardIndex] ?? null;
  const currentTier = currentCard ? (cardTiers.get(currentCard.id) ?? 0) : 0;
  const currentHealth = currentCard ? (cardHealthMap.get(currentCard.id) ?? "healthy") : "healthy";
  const currentVariant = currentCard ? (cardVariants.get(currentCard.id) ?? null) : null;
  const configuredTimer = combatSettings?.timerSeconds ?? 30;
  const totalTime = configuredTimer === 0 ? Infinity : configuredTimer; // 0 = disabled

  // -- Intro phase: show enemy appearance message, then transition to card --
  useEffect(() => {
    if (phase !== "intro") return;
    const timer = setTimeout(() => {
      setPhase("card");
      setCardStart(Date.now());
    }, 1500);
    return () => clearTimeout(timer);
  }, [phase]);

  // -- Resolve phase: brief pause to show damage, then check combat state --
  useEffect(() => {
    if (phase !== "resolve") return;
    const timer = setTimeout(() => {
      const result = isCombatOver(combat);
      if (result.over) {
        finishCombat(result.victory);
      } else if (combat.currentCardIndex >= cardQueue.length) {
        // Out of cards - finish with current state
        finishCombat(combat.enemy.hp <= 0);
      } else {
        setPhase("card");
        setInput("");
        setLastQuality(null);
        setLastDamage(null);
        setCardStart(Date.now());
        setUndoUsed(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [phase, combat]);

  // -- Handle [U] undo during resolve phase --
  useInput(
    (input) => {
      if ((input === "u" || input === "U") && !undoUsed && preAnswerSnapshot) {
        // Restore pre-answer state
        setCombat(preAnswerSnapshot.combat);
        setCardQueue(preAnswerSnapshot.cardQueue);
        setRequeueCounts(preAnswerSnapshot.requeueCounts);
        setActiveEffects(preAnswerSnapshot.activeEffects);
        setActiveAbilities(preAnswerSnapshot.activeAbilities);
        setCurrentSp(preAnswerSnapshot.currentSp);
        setPreAnswerSnapshot(null);
        setPhase("card");
        setInput("");
        setLastQuality(null);
        setLastDamage(null);
        setCardStart(Date.now());
        setUndoUsed(true);
        setUndoMsg("Answer undone");
        setTimeout(() => setUndoMsg(null), 1500);
      }
    },
    { isActive: phase === "resolve" },
  );

  const finishCombat = useCallback(
    (won: boolean) => {
      setVictory(won);
      if (won) {
        const combatRewards = getCombatRewards(
          combat,
          enemy,
          streakBonusPct,
          stats.xpBonusPct,
          stats.goldBonusPct,
          parsedEffects,
        );
        setRewards(combatRewards);
        const droppedLoot = rollLoot(enemy.tier);
        setLoot(droppedLoot);
      } else {
        setRewards({ xp: 0, gold: 0 });
        // Select a lore fragment for defeat
        const lore = selectLore(enemy.tier, seenLoreIds ?? new Set());
        if (lore) {
          setDefeatLore(lore);
          if (onLoreSeen) {
            onLoreSeen(lore.id);
          }
        }
      }
      setPhase("result");
    },
    [combat, enemy, streakBonusPct, stats.xpBonusPct, stats.goldBonusPct, parsedEffects, seenLoreIds, onLoreSeen],
  );

  // -- Handle answer submission in card phase --
  const handleSubmit = useCallback(
    (answer: string) => {
      if (!currentCard) return;
      // Save snapshot for undo before processing
      setPreAnswerSnapshot({
        combat: structuredClone(combat),
        cardQueue: [...cardQueue],
        requeueCounts: new Map(requeueCounts),
        activeEffects: activeEffects.map((e) => ({ ...e })),
        activeAbilities: activeAbilities.map((a) => ({ ...a, ability: { ...a.ability } })),
        currentSp,
      });
      setUndoUsed(false);

      const responseTime = (Date.now() - cardStart) / 1000;
      let quality = evaluateAnswer(currentCard, answer, responseTime, totalTime);
      // Ascension: treat Partial as Wrong when partial credit is disabled
      if (quality === AnswerQuality.Partial && combatSettings?.partialCreditEnabled === false) {
        quality = AnswerQuality.Wrong;
      }
      setLastQuality(quality);

      // Resolve wager if active
      if (currentWager !== "none") {
        const isCorrect = quality === AnswerQuality.Perfect || quality === AnswerQuality.Correct;
        const wagerResult = calculateWagerResult(currentWager, isCorrect, player.gold);
        setLastWagerResult(wagerResult);
        setWagerResults((prev) => [...prev, wagerResult]);
        setCurrentWager("none");
      } else {
        setLastWagerResult(null);
      }

      // Track per-card answer quality for FSRS scheduling
      setCardResults((prev) => [...prev, { cardId: currentCard.id, quality }]);

      // Apply active effects to attack power
      let attackPower = stats.attack;
      let critChance = stats.critChancePct;
      const remainingEffects: AbilityEffect[] = [];
      for (const effect of activeEffects) {
        if (effect.type === "damage_boost" && (quality === AnswerQuality.Perfect || quality === AnswerQuality.Correct)) {
          attackPower = Math.ceil(attackPower * effect.value);
        } else if (effect.type === "critical_boost" && quality === AnswerQuality.Perfect) {
          attackPower = Math.ceil(attackPower * effect.value);
        } else if (effect.type === "absorb_damage" && (quality === AnswerQuality.Wrong || quality === AnswerQuality.Timeout)) {
          // Will be handled below — prevent enemy damage
        }
        // Decrement duration
        if (effect.duration > 1) {
          remainingEffects.push({ ...effect, duration: effect.duration - 1 });
        }
      }
      setActiveEffects(remainingEffects);

      const { newState, event } = resolveTurn(
        combat,
        quality,
        attackPower,
        stats.defense,
        critChance,
        undefined,
        undefined,
        currentTier,
        retrievalMode,
        parsedEffects,
      );

      // Check if we should absorb damage
      const shouldAbsorb = activeEffects.some(
        (e) => e.type === "absorb_damage" && (quality === AnswerQuality.Wrong || quality === AnswerQuality.Timeout),
      );
      const finalState = shouldAbsorb
        ? { ...newState, playerHp: combat.playerHp }
        : newState;

      // Re-apply ascension poison damage for next turn
      if (combatSettings?.enemyPoisonDamage && combatSettings.enemyPoisonDamage > 0) {
        finalState.poisonDamage = combatSettings.enemyPoisonDamage;
      }

      // Re-queue failed cards for successive relearning (if remaining cards exist)
      if (
        currentCard &&
        (quality === AnswerQuality.Wrong || quality === AnswerQuality.Timeout)
      ) {
        const count = requeueCounts.get(currentCard.id) ?? 0;
        if (count < MAX_REQUEUES) {
          setCardQueue((prev) => [...prev, currentCard]);
          // Update totalCards in the combat state so index check works
          finalState.totalCards = cardQueue.length + 1;
          setRequeueCounts((prev) => {
            const next = new Map(prev);
            next.set(currentCard.id, count + 1);
            return next;
          });
        }
      }

      setCombat(finalState);

      // Boss phase transition check
      if (bossPhases && enemy.maxHp > 0) {
        const prevHpPct = combat.enemy.hp / enemy.maxHp;
        const newHpPct = finalState.enemy.hp / enemy.maxHp;
        const transition = hasPhaseChanged(bossPhases, prevHpPct, newHpPct);
        if (transition.changed && transition.newPhase) {
          setCurrentBossPhase(transition.newPhase);
          setPhaseTransitionMsg(`${enemy.name} enters ${transition.newPhase.name}! ${transition.newPhase.description}`);
          setTimeout(() => setPhaseTransitionMsg(null), 3000);
        }
      }

      // Tick cooldowns after each answer
      setActiveAbilities((prev) => tickCooldowns(prev));

      // Determine damage number display type
      setLastDamage(event.damage);
      if (event.action === "player_critical") {
        setLastDamageType("critical");
      } else if (
        event.action === "player_attack" ||
        event.action === "player_glancing"
      ) {
        setLastDamageType("dealt");
      } else {
        setLastDamageType("received");
      }

      setPhase("resolve");
    },
    [currentCard, cardStart, combat, stats, activeEffects, currentTier, combatSettings, cardQueue, requeueCounts, parsedEffects],
  );

  // -- Handle [A] key to open ability menu, [W] to open wager during card phase --
  useInput(
    (input) => {
      if (input.toLowerCase() === "a" && unlockedAbilities.length > 0) {
        setPhase("ability_menu");
      } else if (input.toLowerCase() === "w" && player.gold > 0) {
        setPhase("wager");
      }
    },
    { isActive: phase === "card" && !cardActionMsg },
  );

  // -- Handle wager selection --
  useInput(
    (input, key) => {
      if (key.escape || input.toLowerCase() === "b") {
        setCurrentWager("none");
        setPhase("card");
        return;
      }
      const levels: WagerLevel[] = ["none", "low", "high", "all_in"];
      const idx = parseInt(input, 10) - 1;
      if (idx >= 0 && idx < levels.length) {
        setCurrentWager(levels[idx]);
        setPhase("card");
      }
    },
    { isActive: phase === "wager" },
  );

  // -- Handle [S] suspend / [B] bury during card phase --
  useInput(
    (input) => {
      if (!currentCard) return;
      if (input === "s" || input === "S") {
        try {
          const db = getDatabase();
          const statsRepo = new StatsRepository(db);
          statsRepo.suspendCard(currentCard.id);
          setCardActionMsg("Card suspended");
          setTimeout(() => {
            setCardActionMsg(null);
            // Advance to next card in combat
            setCombat((prev) => ({
              ...prev,
              currentCardIndex: prev.currentCardIndex + 1,
            }));
            setPhase("resolve");
          }, 800);
        } catch {
          // ignore
        }
      } else if (input === "b" || input === "B") {
        try {
          const db = getDatabase();
          const statsRepo = new StatsRepository(db);
          statsRepo.buryCard(currentCard.id);
          setCardActionMsg("Card buried until tomorrow");
          setTimeout(() => {
            setCardActionMsg(null);
            // Advance to next card in combat
            setCombat((prev) => ({
              ...prev,
              currentCardIndex: prev.currentCardIndex + 1,
            }));
            setPhase("resolve");
          }, 800);
        } catch {
          // ignore
        }
      }
    },
    { isActive: phase === "card" && !cardActionMsg },
  );

  // -- Handle ability selection in ability menu --
  useInput(
    (input, key) => {
      if (key.escape || input.toLowerCase() === "b") {
        setPhase("card");
        setAbilityMessage(null);
        return;
      }
      const idx = parseInt(input, 10) - 1;
      if (idx >= 0 && idx < unlockedAbilities.length) {
        const ability = unlockedAbilities[idx];
        if (!canUseAbility(ability, player.level, currentSp, activeAbilities)) {
          setAbilityMessage("Cannot use — not enough SP or on cooldown");
          return;
        }
        // Use the ability
        setCurrentSp((sp) => sp - ability.spCost);
        const effect = getAbilityEffect(ability.key);

        // Handle immediate effects
        if (effect.type === "heal") {
          const healAmount = Math.ceil(stats.maxHp * (effect.value / 100));
          setCombat((prev) => ({
            ...prev,
            playerHp: Math.min(stats.maxHp, prev.playerHp + healAmount),
          }));
          setAbilityMessage(`${ability.name}! Healed ${healAmount} HP`);
        } else {
          setActiveEffects((prev) => [...prev, effect]);
          setAbilityMessage(`${ability.name} activated!`);
        }

        // Track cooldown
        setActiveAbilities((prev) => [
          ...prev.filter((a) => a.ability.key !== ability.key),
          { ability, remainingCooldown: ability.cooldownTurns },
        ]);

        // Return to card phase after a brief moment
        setTimeout(() => {
          setPhase("card");
          setAbilityMessage(null);
        }, 800);
      }
    },
    { isActive: phase === "ability_menu" },
  );

  // -- Handle Enter in result phase: transition to reflection --
  useInput(
    (_input, key) => {
      if (phase === "result" && key.return) {
        // If there's loot and it hasn't been dismissed yet, wait for LootDrop
        if (loot && !lootDismissed) return;

        const wagerNet = wagerResults.reduce((sum, w) => sum + w.goldDelta, 0);
        const result: CombatResult = {
          victory,
          xpEarned: rewards?.xp ?? 0,
          goldEarned: (rewards?.gold ?? 0) + wagerNet,
          loot: loot,
          events: combat.events,
          cardsReviewed: combat.currentCardIndex,
          perfectCount: combat.stats.perfectCount,
          correctCount: combat.stats.correctCount,
          playerHpRemaining: combat.playerHp,
          cardResults,
        };
        setCombatResult(result);
        setPhase("reflection");
      }
    },
    { isActive: phase === "result" },
  );

  // -- Handle reflection completion --
  const handleReflectionComplete = useCallback(
    (_result: { difficultyRating: 1 | 2 | 3; journalEntry?: string; wisdomXp: number }) => {
      if (combatResult) {
        onComplete(combatResult);
      }
    },
    [combatResult, onComplete],
  );

  // ─── Render ───────────────────────────────────────────

  // Encounter preview phase
  if (phase === "encounter_preview") {
    return (
      <EncounterPreview
        enemy={combat.enemy}
        cardCount={cards.length}
        previewData={previewData}
        isDungeonFloor={isDungeonFloor}
        onFight={() => setPhase("intro")}
        onRetreat={onRetreat}
      />
    );
  }

  // Intro phase
  if (phase === "intro") {
    return (
      <Box flexDirection="column" paddingX={1} alignItems="center">
        <Box marginY={1}>
          <EnemyDisplay enemy={combat.enemy} />
        </Box>
        <Text bold color={theme.colors.warning}>
          A {enemy.name} appears!
        </Text>
      </Box>
    );
  }

  // Ability menu phase
  if (phase === "ability_menu") {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <EnemyDisplay enemy={combat.enemy} />
        </Box>
        <Box marginBottom={1}>
          <Text bold>SP: </Text>
          <Text color="cyan">{currentSp}</Text>
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={1}>
          <Text bold color="cyan">Abilities</Text>
          {unlockedAbilities.map((ability, idx) => {
            const usable = canUseAbility(ability, player.level, currentSp, activeAbilities);
            const active = activeAbilities.find((a) => a.ability.key === ability.key);
            const cdText = active && active.remainingCooldown > 0
              ? ` (CD: ${active.remainingCooldown})`
              : "";
            return (
              <Text key={ability.key} dimColor={!usable}>
                <Text bold={usable} color={usable ? "green" : undefined}>
                  [{idx + 1}] {ability.name}
                </Text>
                <Text dimColor> — {ability.description} (SP: {ability.spCost}){cdText}</Text>
              </Text>
            );
          })}
          {abilityMessage && (
            <Box marginTop={1}>
              <Text color="yellow">{abilityMessage}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text dimColor italic>Press [1-{unlockedAbilities.length}] to use, [B/Esc] to cancel</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Wager phase
  if (phase === "wager") {
    const levels: WagerLevel[] = ["none", "low", "high", "all_in"];
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <EnemyDisplay enemy={combat.enemy} />
        </Box>
        <Box marginBottom={1}>
          <Text bold>Gold: </Text>
          <Text color="yellow">{player.gold}</Text>
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} paddingY={1}>
          <Text bold color="yellow">Wager Gold</Text>
          <Text dimColor>Risk gold on your confidence — correct answers double it!</Text>
          {levels.map((level, idx) => (
            <Text key={level}>
              <Text bold color="yellow">[{idx + 1}]</Text> {WAGER_LABELS[level]}
              {level === currentWager ? <Text color="green"> *</Text> : null}
            </Text>
          ))}
          <Box marginTop={1}>
            <Text dimColor italic>Press [1-4] to choose, [B/Esc] to cancel</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Reflection phase
  if (phase === "reflection") {
    const totalAnswers =
      combat.stats.perfectCount +
      combat.stats.correctCount +
      combat.stats.partialCount +
      combat.stats.wrongCount;
    const combatAccuracy =
      totalAnswers > 0
        ? (combat.stats.perfectCount + combat.stats.correctCount) / totalAnswers
        : 0;
    const cpjMessages = shouldShowCPJ(combatAccuracy)
      ? generateCPJReframe(combatAccuracy, [])
      : undefined;

    return (
      <ReflectionScreen
        accuracy={combatAccuracy}
        cardsReviewed={combat.currentCardIndex}
        cpjMessages={cpjMessages}
        showJournal={shouldShowJournal()}
        reflectionPrompt={selectPrompt(null)}
        onComplete={handleReflectionComplete}
      />
    );
  }

  // Result phase
  if (phase === "result") {
    // Show loot drop overlay if loot exists and hasn't been dismissed
    if (loot && !lootDismissed) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Box marginBottom={1} flexDirection="column" alignItems="center">
            <Text bold color={theme.colors.success}>
              Victory!
            </Text>
            <Text>
              <Text color={theme.colors.xp}>+{rewards?.xp ?? 0} XP</Text>
              {"  "}
              <Text color={theme.colors.gold}>+{rewards?.gold ?? 0} Gold</Text>
            </Text>
          </Box>
          <LootDrop
            equipment={loot}
            onDismiss={() => setLootDismissed(true)}
          />
        </Box>
      );
    }

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <EnemyDisplay enemy={combat.enemy} />
        </Box>
        <Box flexDirection="column" alignItems="center">
          {victory ? (
            <>
              <Text bold color={theme.colors.success}>
                Victory!
              </Text>
              <Text>
                <Text color={theme.colors.xp}>+{rewards?.xp ?? 0} XP</Text>
                {"  "}
                <Text color={theme.colors.gold}>
                  +{rewards?.gold ?? 0} Gold
                </Text>
              </Text>
            </>
          ) : (
            <>
              <Text bold color={theme.colors.damage}>
                Defeat...
              </Text>
              <Text dimColor>
                You fell, but strengthened {combat.currentCardIndex} memory {combat.currentCardIndex === 1 ? "trace" : "traces"}
              </Text>
              {defeatLore && (
                <LoreReveal lore={defeatLore} />
              )}
            </>
          )}
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>
              Cards reviewed: {combat.currentCardIndex}/{cards.length}
            </Text>
            <Text dimColor>
              Perfect: {combat.stats.perfectCount} | Correct:{" "}
              {combat.stats.correctCount} | Partial: {combat.stats.partialCount}{" "}
              | Wrong: {combat.stats.wrongCount}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor italic>
              Press Enter to continue...
            </Text>
          </Box>
        </Box>
        <Box marginTop={1}>
          <CombatLog events={combat.events} />
        </Box>
      </Box>
    );
  }

  // Card and Resolve phases share the same layout
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Top: Enemy display */}
      <Box marginBottom={1}>
        <EnemyDisplay enemy={combat.enemy} />
      </Box>

      {/* Boss phase indicator */}
      {currentBossPhase && (
        <Box marginBottom={1}>
          <Text bold color={currentBossPhase.damageMultiplier >= 2.0 ? "red" : currentBossPhase.damageMultiplier >= 1.5 ? "yellow" : "cyan"}>
            Phase: {currentBossPhase.name}
          </Text>
          {currentBossPhase.hintsDisabled && <Text dimColor> (Hints disabled)</Text>}
          {currentBossPhase.xpMultiplier > 1.0 && <Text color="magenta"> ({currentBossPhase.xpMultiplier}x XP)</Text>}
        </Box>
      )}
      {/* Phase transition announcement */}
      {phaseTransitionMsg && (
        <Box marginBottom={1}>
          <Text bold color="yellow">{phaseTransitionMsg}</Text>
        </Box>
      )}

      {/* Player HP and SP */}
      <Box marginBottom={1}>
        <Text>
          <Text bold>HP: </Text>
          <Text color={combat.playerHp > stats.maxHp * 0.25 ? "green" : "red"}>
            {combat.playerHp}
          </Text>
          <Text>/{stats.maxHp}</Text>
          {unlockedAbilities.length > 0 && (
            <>
              <Text>{"  "}</Text>
              <Text bold>SP: </Text>
              <Text color="cyan">{currentSp}</Text>
            </>
          )}
          <Text dimColor>
            {"  "}Card {combat.currentCardIndex + 1}/{cardQueue.length}
          </Text>
        </Text>
      </Box>

      {/* Suspend/Bury confirmation */}
      {cardActionMsg && phase === "card" && (
        <Box marginTop={1}>
          <Text bold color="yellow">{cardActionMsg}</Text>
        </Box>
      )}

      {/* Middle: Card content */}
      {phase === "card" && currentCard && !cardActionMsg && (
        <>
          <FlashcardFace card={currentCard} showAnswer={false} evolutionTier={currentTier} cardHealth={currentHealth} isRetry={(requeueCounts.get(currentCard.id) ?? 0) > 0 && combat.currentCardIndex >= cards.length} variant={currentVariant as any} />
          {retrievalMode === RetrievalMode.Generate && (
            <Box marginTop={1}>
              <Text color="magenta" bold>Cue: {generatePartialCue(currentCard.back)}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text bold>Your answer: </Text>
            <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
          </Box>
          {currentWager !== "none" && (
            <Text color="yellow" bold>Wager: {WAGER_LABELS[currentWager]}</Text>
          )}
          <Text dimColor italic>
            {unlockedAbilities.length > 0 ? "[A] abilities | " : ""}[W] wager | [S] suspend | [B] bury
          </Text>
        </>
      )}

      {/* Undo confirmation message */}
      {undoMsg && (
        <Box marginTop={1}>
          <Text bold color="yellow">{undoMsg}</Text>
        </Box>
      )}

      {phase === "resolve" && (
        <Box flexDirection="column" marginTop={1}>
          {lastQuality !== null && <QualityFeedback quality={lastQuality} />}
          {currentCard && (
            <Text dimColor>
              Answer: <Text color="green">{cardQueue[combat.currentCardIndex - 1]?.back ?? ""}</Text>
            </Text>
          )}
          {lastWagerResult && (
            <Text color={lastWagerResult.goldDelta >= 0 ? "yellow" : "red"} bold>
              Wager: {lastWagerResult.goldDelta >= 0 ? "+" : ""}{lastWagerResult.goldDelta}g
            </Text>
          )}
          {lastDamage !== null && (
            <Box marginTop={1}>
              <DamageNumber amount={lastDamage} type={lastDamageType} />
            </Box>
          )}
          {!undoUsed && preAnswerSnapshot && (
            <Text dimColor italic>[U] undo</Text>
          )}
        </Box>
      )}

      {/* Bottom: Combat log */}
      <Box marginTop={1}>
        <CombatLog events={combat.events} />
      </Box>
    </Box>
  );
}

function LoreReveal({ lore }: { lore: LoreFragment }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      paddingY={1}
      marginTop={1}
    >
      <Text dimColor italic>
        ...a memory surfaces as consciousness fades...
      </Text>
      <Box marginTop={1}>
        <Text italic>{lore.text}</Text>
      </Box>
    </Box>
  );
}

// QualityFeedback imported from shared component
