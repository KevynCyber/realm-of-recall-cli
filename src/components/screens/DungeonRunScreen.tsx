import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import {
  createDungeonRun,
  getCurrentFloorConfig,
  completeFloor,
  recordDefeat,
  retreat,
  calculateFinalRewards,
  isRunOver,
  shouldTriggerEvent,
} from "../../core/combat/DungeonRun.js";
import type { DungeonRunState } from "../../core/combat/DungeonRun.js";
import { rollForEvent, resolveEventChoice } from "../../core/combat/RandomEvents.js";
import type { RandomEvent, EventOutcome } from "../../core/combat/RandomEvents.js";
import { useGameTheme } from "../app/ThemeProvider.js";
import { ProgressBar } from "../common/ProgressBar.js";

export interface FloorCombatResult {
  victory: boolean;
  goldEarned: number;
  xpEarned: number;
  hpRemaining: number;
}

interface Props {
  playerHp: number;
  playerMaxHp: number;
  playerLevel: number;
  initialRunState?: DungeonRunState | null;
  onFloorCombat: (floorNumber: number) => void;
  floorCombatResult?: FloorCombatResult | null;
  onRunStateChange?: (state: DungeonRunState) => void;
  onComplete: (result: {
    gold: number;
    xp: number;
    floorsCompleted: number;
    completed: boolean;
  }) => void;
  onBack: () => void;
}

type Phase = "floor_preview" | "awaiting_combat" | "event" | "event_result" | "complete";

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <Box marginBottom={1}>
      <Text bold color={color}>
        {label}
      </Text>
    </Box>
  );
}

interface HpBarProps {
  hp: number;
  maxHp: number;
}

function HpBar({ hp, maxHp }: HpBarProps) {
  const pct = maxHp > 0 ? hp / maxHp : 0;
  const barColor =
    pct > 0.5 ? "green" : pct > 0.25 ? "yellow" : "red";
  return (
    <Box>
      <Text bold>HP </Text>
      <ProgressBar value={pct} width={20} filledColor={barColor} />
      <Text>
        {" "}
        <Text color={barColor}>{hp}</Text>
        <Text color="gray">/{maxHp}</Text>
      </Text>
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DungeonRunScreen({
  playerHp,
  playerMaxHp,
  playerLevel,
  initialRunState,
  onFloorCombat,
  floorCombatResult,
  onRunStateChange,
  onComplete,
  onBack,
}: Props) {
  const theme = useGameTheme();

  // Initialise the run state: use saved state from parent if available, else create fresh.
  const [run, setRunInternal] = useState<DungeonRunState>(() =>
    initialRunState ?? createDungeonRun(playerHp, playerMaxHp),
  );

  // Wrap setRun to also notify parent of state changes
  const setRun = useCallback((newRun: DungeonRunState) => {
    setRunInternal(newRun);
    onRunStateChange?.(newRun);
  }, [onRunStateChange]);
  const [phase, setPhase] = useState<Phase>(
    floorCombatResult ? "awaiting_combat" : "floor_preview",
  );
  const [activeEvent, setActiveEvent] = useState<RandomEvent | null>(null);
  const [eventOutcome, setEventOutcome] = useState<EventOutcome | null>(null);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const finishRun = useCallback(
    (finalRun: DungeonRunState) => {
      const rewards = calculateFinalRewards(finalRun);
      onComplete({
        gold: rewards.gold,
        xp: rewards.xp,
        floorsCompleted: finalRun.floorsCompleted,
        completed: finalRun.completed,
      });
    },
    [onComplete],
  );

  const advanceAfterFloor = useCallback(
    (updatedRun: DungeonRunState) => {
      if (isRunOver(updatedRun)) {
        setRun(updatedRun);
        setPhase("complete");
        return;
      }

      // Check whether a random event fires between floors.
      if (shouldTriggerEvent()) {
        const hpPct = (updatedRun.playerHp / updatedRun.playerMaxHp) * 100;
        const event = rollForEvent(hpPct);
        if (event) {
          setRun(updatedRun);
          setActiveEvent(event);
          setPhase("event");
          return;
        }
      }

      setRun(updatedRun);
      setPhase("floor_preview");
    },
    [],
  );

  // ─── Process combat results from parent ──────────────────────────────────

  // Track whether we've already processed the current result to avoid re-processing.
  const lastProcessedResult = useRef<FloorCombatResult | null>(null);

  useEffect(() => {
    if (
      phase !== "awaiting_combat" ||
      !floorCombatResult ||
      floorCombatResult === lastProcessedResult.current
    ) {
      return;
    }
    lastProcessedResult.current = floorCombatResult;

    if (floorCombatResult.victory) {
      const updated = completeFloor(
        run,
        floorCombatResult.goldEarned,
        floorCombatResult.xpEarned,
        floorCombatResult.hpRemaining,
      );
      advanceAfterFloor(updated);
    } else {
      const updated = recordDefeat(run);
      setRun(updated);
      setPhase("complete");
    }
  }, [phase, floorCombatResult, run, advanceAfterFloor]);

  // ─── Input handling ───────────────────────────────────────────────────────

  useInput(
    (input, key) => {
      const floorConfig = getCurrentFloorConfig(run);

      // ── Floor preview ──────────────────────────────────────────────────
      if (phase === "floor_preview") {
        if (key.return) {
          // Delegate to parent to render real CombatScreen for this floor.
          onFloorCombat(run.currentFloor);
          setPhase("awaiting_combat");
          return;
        }

        // [R] Retreat
        if (input.toLowerCase() === "r") {
          const updated = retreat(run);
          setRun(updated);
          setPhase("complete");
          return;
        }

        // [Escape] / [B] go back only from floor 1 before entering combat.
        if ((key.escape || input.toLowerCase() === "b") && run.currentFloor === 1 && run.floorsCompleted === 0) {
          onBack();
          return;
        }
      }

      // ── Event ──────────────────────────────────────────────────────────
      if (phase === "event" && activeEvent) {
        if (input === "1" || input === "2") {
          const choiceIndex = parseInt(input, 10) - 1;
          const outcome = resolveEventChoice(
            activeEvent,
            choiceIndex,
            playerLevel,
            run.playerMaxHp,
          );
          setEventOutcome(outcome);

          // Apply outcome to run state.
          const hpAfter = Math.min(
            run.playerMaxHp,
            Math.max(0, run.playerHp + outcome.hpChange),
          );
          const updatedRun: DungeonRunState = {
            ...run,
            playerHp: hpAfter,
            totalGoldEarned: run.totalGoldEarned + Math.max(0, outcome.goldChange),
            totalXpEarned: run.totalXpEarned + Math.max(0, outcome.xpChange),
          };
          setRun(updatedRun);
          setPhase("event_result");
          return;
        }
      }

      // ── Event result ───────────────────────────────────────────────────
      if (phase === "event_result") {
        if (key.return) {
          setActiveEvent(null);
          setEventOutcome(null);
          setPhase("floor_preview");
          return;
        }
      }

      // ── Complete ───────────────────────────────────────────────────────
      if (phase === "complete") {
        if (key.return) {
          finishRun(run);
          return;
        }
      }
    },
    { isActive: phase !== "awaiting_combat" },
  );

  // ─── Render helpers ───────────────────────────────────────────────────────

  const floorConfig = getCurrentFloorConfig(run);
  const totalFloors = run.maxFloors;

  // ── Floor preview ──────────────────────────────────────────────────────────
  if (phase === "floor_preview") {
    const isFirstFloor = run.currentFloor === 1 && run.floorsCompleted === 0;
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        {/* Header */}
        <SectionHeader
          label={`=== DUNGEON RUN ===`}
          color={theme.colors.warning}
        />

        {/* Floor indicator */}
        <Box marginBottom={1} flexDirection="column">
          <Text bold color={floorConfig.isBoss ? theme.colors.epic : theme.colors.mana}>
            {floorConfig.isBoss ? "BOSS FLOOR" : `Floor ${run.currentFloor} / ${totalFloors}`}
          </Text>
          <Box>
            {Array.from({ length: totalFloors }, (_, i) => {
              const floorNum = i + 1;
              const isDone = floorNum < run.currentFloor;
              const isCurrent = floorNum === run.currentFloor;
              const isBossFloor = floorNum === totalFloors;
              let char = isBossFloor ? "B" : String(floorNum);
              let color: string = theme.colors.muted;
              if (isDone) color = theme.colors.success;
              if (isCurrent) color = floorConfig.isBoss ? theme.colors.epic : theme.colors.warning;
              return (
                <Text key={floorNum} color={color} bold={isCurrent}>
                  {`[${char}]`}
                </Text>
              );
            })}
          </Box>
        </Box>

        {/* Floor modifiers */}
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>
            Enemy HP:{"  "}
            <Text color={theme.colors.damage}>
              {floorConfig.enemyHpMultiplier.toFixed(1)}x
            </Text>
          </Text>
          <Text dimColor>
            Rewards:{"  "}
            <Text color={theme.colors.gold}>
              {floorConfig.rewardMultiplier.toFixed(1)}x
            </Text>
          </Text>
          {floorConfig.isBoss && (
            <Text bold color={theme.colors.epic}>
              *** THE BOSS AWAITS ***
            </Text>
          )}
        </Box>

        {/* Player HP */}
        <Box marginBottom={1}>
          <HpBar hp={run.playerHp} maxHp={run.playerMaxHp} />
        </Box>

        {/* Earnings so far */}
        {(run.totalGoldEarned > 0 || run.totalXpEarned > 0) && (
          <Box marginBottom={1}>
            <Text dimColor>Earned so far:{"  "}</Text>
            <Text color={theme.colors.gold}>{run.totalGoldEarned} Gold</Text>
            <Text dimColor>{"  "}</Text>
            <Text color={theme.colors.xp}>{run.totalXpEarned} XP</Text>
          </Box>
        )}

        {/* Controls */}
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={theme.colors.success}>
            [Enter] Begin floor
          </Text>
          {run.floorsCompleted > 0 && (
            <Text color={theme.colors.warning}>[R] Retreat (keep current rewards)</Text>
          )}
          {isFirstFloor && (
            <Text dimColor>[B] Back</Text>
          )}
        </Box>
      </Box>
    );
  }

  // ── Awaiting combat (parent renders CombatScreen) ─────────────────────────
  if (phase === "awaiting_combat") {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text dimColor>Combat in progress...</Text>
      </Box>
    );
  }

  // ── Event ──────────────────────────────────────────────────────────────────
  if (phase === "event" && activeEvent) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <SectionHeader label="=== RANDOM EVENT ===" color={theme.colors.mana} />

        <Box marginBottom={1} flexDirection="column">
          <Text bold color={theme.colors.warning}>
            {activeEvent.title}
          </Text>
          <Text>{activeEvent.description}</Text>
        </Box>

        <Box marginBottom={1}>
          <HpBar hp={run.playerHp} maxHp={run.playerMaxHp} />
        </Box>

        <Box flexDirection="column" marginTop={1}>
          {activeEvent.choices.map((choice, idx) => (
            <Box key={idx} marginBottom={1} flexDirection="column">
              <Text bold color={theme.colors.success}>
                [{idx + 1}] {choice.label}
              </Text>
              <Text dimColor>    {choice.description}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  // ── Event result ───────────────────────────────────────────────────────────
  if (phase === "event_result" && eventOutcome) {
    const hasGoldChange = eventOutcome.goldChange !== 0;
    const hasHpChange = eventOutcome.hpChange !== 0;
    const hasXpChange = eventOutcome.xpChange !== 0;
    const hasWisdomXp = eventOutcome.wisdomXpChange !== 0;
    const hasShield = eventOutcome.shieldChange !== 0;

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <SectionHeader label="=== EVENT OUTCOME ===" color={theme.colors.mana} />

        <Box marginBottom={1}>
          <Text>{eventOutcome.description}</Text>
        </Box>

        {/* Changes */}
        <Box flexDirection="column" marginBottom={1}>
          {hasGoldChange && (
            <Text color={eventOutcome.goldChange > 0 ? theme.colors.gold : theme.colors.damage}>
              {eventOutcome.goldChange > 0 ? "+" : ""}
              {eventOutcome.goldChange} Gold
            </Text>
          )}
          {hasHpChange && (
            <Text color={eventOutcome.hpChange > 0 ? theme.colors.healing : theme.colors.damage}>
              {eventOutcome.hpChange > 0 ? "+" : ""}
              {eventOutcome.hpChange} HP
            </Text>
          )}
          {hasXpChange && (
            <Text color={theme.colors.xp}>
              {eventOutcome.xpChange > 0 ? "+" : ""}
              {eventOutcome.xpChange} XP
            </Text>
          )}
          {hasWisdomXp && (
            <Text color={theme.colors.mana}>
              +{eventOutcome.wisdomXpChange} Wisdom XP
            </Text>
          )}
          {hasShield && (
            <Text color={theme.colors.rare}>
              +{eventOutcome.shieldChange} Streak Shield
            </Text>
          )}
          {eventOutcome.evolutionBoost && (
            <Text color={theme.colors.epic}>Card evolution boosted!</Text>
          )}
        </Box>

        {/* Updated HP */}
        <Box marginBottom={1}>
          <HpBar hp={run.playerHp} maxHp={run.playerMaxHp} />
        </Box>

        <Text dimColor italic>
          Press Enter to continue...
        </Text>
      </Box>
    );
  }

  // ── Complete ───────────────────────────────────────────────────────────────
  if (phase === "complete") {
    const rewards = calculateFinalRewards(run);

    let headingText = "Dungeon Complete!";
    let headingColor = theme.colors.success;
    if (run.defeated) {
      headingText = "Defeated!";
      headingColor = theme.colors.damage;
    } else if (run.retreated) {
      headingText = "Retreated";
      headingColor = theme.colors.warning;
    }

    const multiplierColor =
      rewards.bonusMultiplier >= 2
        ? theme.colors.epic
        : rewards.bonusMultiplier >= 1
          ? theme.colors.success
          : theme.colors.damage;

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <SectionHeader label="=== RUN SUMMARY ===" color={headingColor} />

        <Box marginBottom={1}>
          <Text bold color={headingColor}>
            {headingText}
          </Text>
        </Box>

        {/* Floors completed */}
        <Box marginBottom={1}>
          <Text>
            Floors completed:{" "}
            <Text bold color={theme.colors.warning}>
              {run.floorsCompleted} / {run.maxFloors}
            </Text>
          </Text>
        </Box>

        {/* Bonus multiplier */}
        <Box marginBottom={1}>
          <Text>
            Bonus multiplier:{" "}
            <Text bold color={multiplierColor}>
              {rewards.bonusMultiplier.toFixed(1)}x
            </Text>
          </Text>
        </Box>

        {/* Final rewards */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Final rewards:</Text>
          <Text>
            {"  "}
            <Text color={theme.colors.gold}>{rewards.gold} Gold</Text>
            {"    "}
            <Text color={theme.colors.xp}>{rewards.xp} XP</Text>
          </Text>
          {run.defeated && (
            <Text dimColor italic>
              (Halved due to defeat)
            </Text>
          )}
          {run.completed && (
            <Text color={theme.colors.epic} italic>
              Completion bonus: 2x rewards!
            </Text>
          )}
        </Box>

        <Text dimColor italic>
          Press Enter to return...
        </Text>
      </Box>
    );
  }

  // Fallback (should not be reached).
  return null;
}
