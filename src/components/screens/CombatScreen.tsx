import React, { useState, useEffect, useCallback } from "react";
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

type Phase = "intro" | "card" | "resolve" | "result";

interface Props {
  cards: Card[];
  enemy: Enemy;
  player: Player;
  equippedItems: Equipment[];
  streakBonusPct: number;
  onComplete: (result: CombatResult) => void;
}

export function CombatScreen({
  cards,
  enemy,
  player,
  equippedItems,
  streakBonusPct,
  onComplete,
}: Props) {
  const theme = useGameTheme();
  const stats = getEffectiveStats(player, equippedItems);

  const [phase, setPhase] = useState<Phase>("intro");
  const [combat, setCombat] = useState<CombatState>(() =>
    createCombatState(enemy, stats.maxHp, player.hp, cards.length),
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

  const currentCard = cards[combat.currentCardIndex] ?? null;
  const totalTime = 30; // seconds per card

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
      const quality = evaluateAnswer(currentCard, answer, responseTime, totalTime);
      setLastQuality(quality);

      const { newState, event } = resolveTurn(
        combat,
        quality,
        stats.attack,
        stats.defense,
        stats.critChancePct,
      );
      setCombat(newState);

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
    [currentCard, cardStart, combat, stats],
  );

  // -- Handle Enter in result phase --
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
        onComplete(result);
      }
    },
    { isActive: phase === "result" },
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

      {/* Player HP */}
      <Box marginBottom={1}>
        <Text>
          <Text bold>HP: </Text>
          <Text color={combat.playerHp > stats.maxHp * 0.25 ? "green" : "red"}>
            {combat.playerHp}
          </Text>
          <Text>/{stats.maxHp}</Text>
          <Text dimColor>
            {"  "}Card {combat.currentCardIndex + 1}/{cards.length}
          </Text>
        </Text>
      </Box>

      {/* Middle: Card content */}
      {phase === "card" && currentCard && (
        <>
          <FlashcardFace card={currentCard} showAnswer={false} />
          <Box marginTop={1}>
            <Text bold>Your answer: </Text>
            <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
          </Box>
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
