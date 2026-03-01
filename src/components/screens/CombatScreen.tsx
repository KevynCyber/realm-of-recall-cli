import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { Card, CombatResult, Equipment } from "../../types/index.js";
import { AnswerQuality } from "../../types/index.js";
import type { Enemy } from "../../types/combat.js";
import type { Player } from "../../types/player.js";
import {
  createCombatState,
  resolveTurn,
  isCombatOver,
  getCombatRewards,
} from "../../core/combat/CombatEngine.js";
import type { CombatState } from "../../core/combat/CombatEngine.js";
import { rollLoot } from "../../core/combat/LootTable.js";
import { evaluateAnswer } from "../../core/cards/CardEvaluator.js";
import { getEffectiveStats } from "../../core/player/PlayerStats.js";
import { EnemyDisplay } from "../combat/EnemyDisplay.js";
import { CombatLog } from "../combat/CombatLog.js";
import { LootDrop } from "../combat/LootDrop.js";
import { DamageNumber } from "../combat/DamageNumber.js";
import { FlashcardFace } from "../review/FlashcardFace.js";
import { useGameTheme } from "../app/ThemeProvider.js";
import { ReflectionScreen } from "../review/ReflectionScreen.js";
import { getDatabase } from "../../data/database.js";
import { StatsRepository } from "../../data/repositories/StatsRepository.js";
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

type Phase = "intro" | "card" | "resolve" | "result" | "reflection" | "ability_menu";

interface Props {
  cards: Card[];
  enemy: Enemy;
  player: Player;
  equippedItems: Equipment[];
  streakBonusPct: number;
  combatSettings?: CombatSettings;
  onComplete: (result: CombatResult) => void;
}

export function CombatScreen({
  cards,
  enemy,
  player,
  equippedItems,
  streakBonusPct,
  combatSettings,
  onComplete,
}: Props) {
  const theme = useGameTheme();
  const stats = getEffectiveStats(player, equippedItems);

  const [phase, setPhase] = useState<Phase>("intro");
  const [combat, setCombat] = useState<CombatState>(() => {
    // Apply startingHpPercent from ascension settings
    const startHpPct = combatSettings?.startingHpPercent ?? 100;
    const startingHp = startHpPct < 100
      ? Math.max(1, Math.floor(player.hp * (startHpPct / 100)))
      : player.hp;
    const state = createCombatState(enemy, stats.maxHp, startingHp, cards.length);
    // Apply ascension poison damage per turn
    if (combatSettings?.enemyPoisonDamage && combatSettings.enemyPoisonDamage > 0) {
      state.poisonDamage = combatSettings.enemyPoisonDamage;
    }
    return state;
  });
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

  // Ability state
  const [currentSp, setCurrentSp] = useState(player.skillPoints);
  const [activeAbilities, setActiveAbilities] = useState<ActiveAbility[]>([]);
  const [activeEffects, setActiveEffects] = useState<AbilityEffect[]>([]);
  const [abilityMessage, setAbilityMessage] = useState<string | null>(null);
  const unlockedAbilities = getUnlockedAbilities(player.class, player.level);

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

  const currentCard = cards[combat.currentCardIndex] ?? null;
  const currentTier = currentCard ? (cardTiers.get(currentCard.id) ?? 0) : 0;
  const currentHealth = currentCard ? (cardHealthMap.get(currentCard.id) ?? "healthy") : "healthy";
  const totalTime = combatSettings?.timerSeconds ?? 30; // seconds per card

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
      } else if (combat.currentCardIndex >= cards.length) {
        // Out of cards - finish with current state
        finishCombat(combat.enemy.hp <= 0);
      } else {
        setPhase("card");
        setInput("");
        setLastQuality(null);
        setLastDamage(null);
        setCardStart(Date.now());
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [phase, combat]);

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
        );
        setRewards(combatRewards);
        const droppedLoot = rollLoot(enemy.tier);
        setLoot(droppedLoot);
      } else {
        setRewards({ xp: 0, gold: 0 });
      }
      setPhase("result");
    },
    [combat, enemy, streakBonusPct, stats.xpBonusPct, stats.goldBonusPct],
  );

  // -- Handle answer submission in card phase --
  const handleSubmit = useCallback(
    (answer: string) => {
      if (!currentCard) return;
      const responseTime = (Date.now() - cardStart) / 1000;
      let quality = evaluateAnswer(currentCard, answer, responseTime, totalTime);
      // Ascension: treat Partial as Wrong when partial credit is disabled
      if (quality === AnswerQuality.Partial && combatSettings?.partialCreditEnabled === false) {
        quality = AnswerQuality.Wrong;
      }
      setLastQuality(quality);

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

      setCombat(finalState);

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
    [currentCard, cardStart, combat, stats, activeEffects, currentTier, combatSettings],
  );

  // -- Handle [A] key to open ability menu during card phase --
  useInput(
    (input) => {
      if (input.toLowerCase() === "a" && unlockedAbilities.length > 0) {
        setPhase("ability_menu");
      }
    },
    { isActive: phase === "card" },
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

        const result: CombatResult = {
          victory,
          xpEarned: rewards?.xp ?? 0,
          goldEarned: rewards?.gold ?? 0,
          loot: loot,
          events: combat.events,
          cardsReviewed: combat.currentCardIndex,
          perfectCount: combat.stats.perfectCount,
          correctCount: combat.stats.correctCount,
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
            <Text bold color={theme.colors.damage}>
              Defeat...
            </Text>
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
            {"  "}Card {combat.currentCardIndex + 1}/{cards.length}
          </Text>
        </Text>
      </Box>

      {/* Middle: Card content */}
      {phase === "card" && currentCard && (
        <>
          <FlashcardFace card={currentCard} showAnswer={false} evolutionTier={currentTier} cardHealth={currentHealth} />
          <Box marginTop={1}>
            <Text bold>Your answer: </Text>
            <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
          </Box>
          {unlockedAbilities.length > 0 && (
            <Text dimColor italic>Press [A] for abilities</Text>
          )}
        </>
      )}

      {phase === "resolve" && (
        <Box flexDirection="column" marginTop={1}>
          {lastQuality !== null && <QualityFeedback quality={lastQuality} />}
          {currentCard && (
            <Text dimColor>
              Answer: <Text color="green">{cards[combat.currentCardIndex - 1]?.back ?? ""}</Text>
            </Text>
          )}
          {lastDamage !== null && (
            <Box marginTop={1}>
              <DamageNumber amount={lastDamage} type={lastDamageType} />
            </Box>
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

function QualityFeedback({ quality }: { quality: AnswerQuality }) {
  const config: Record<AnswerQuality, { text: string; color: string }> = {
    [AnswerQuality.Perfect]: { text: "PERFECT!", color: "yellow" },
    [AnswerQuality.Correct]: { text: "Correct!", color: "green" },
    [AnswerQuality.Partial]: { text: "Partial match", color: "cyan" },
    [AnswerQuality.Wrong]: { text: "Wrong!", color: "red" },
    [AnswerQuality.Timeout]: { text: "Time's up!", color: "red" },
  };
  const { text, color } = config[quality];
  return (
    <Text bold color={color}>
      {text}
    </Text>
  );
}
