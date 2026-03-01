import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { RandomEvent, EventOutcome } from "../../core/combat/RandomEvents.js";
import { resolveEventChoice } from "../../core/combat/RandomEvents.js";
import { useGameTheme } from "../app/ThemeProvider.js";

interface Props {
  event: RandomEvent;
  playerLevel: number;
  playerMaxHp: number;
  onComplete: (outcome: EventOutcome) => void;
}

export function RandomEventScreen({
  event,
  playerLevel,
  playerMaxHp,
  onComplete,
}: Props) {
  const theme = useGameTheme();
  const [outcome, setOutcome] = useState<EventOutcome | null>(null);

  useInput((input, key) => {
    if (!outcome) {
      // Choice phase
      if (input === "1" || input === "2") {
        const choiceIndex = parseInt(input, 10) - 1;
        const result = resolveEventChoice(event, choiceIndex, playerLevel, playerMaxHp);
        setOutcome(result);
      }
    } else {
      // Result phase — press Enter to continue
      if (key.return) {
        onComplete(outcome);
      }
    }
  });

  if (outcome) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color={theme.colors.mana}>
            === EVENT OUTCOME ===
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text>{outcome.description}</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          {outcome.goldChange !== 0 && (
            <Text color={outcome.goldChange > 0 ? theme.colors.gold : theme.colors.damage}>
              {outcome.goldChange > 0 ? "+" : ""}{outcome.goldChange} Gold
            </Text>
          )}
          {outcome.hpChange !== 0 && (
            <Text color={outcome.hpChange > 0 ? theme.colors.healing : theme.colors.damage}>
              {outcome.hpChange > 0 ? "+" : ""}{outcome.hpChange} HP
            </Text>
          )}
          {outcome.xpChange !== 0 && (
            <Text color={theme.colors.xp}>
              {outcome.xpChange > 0 ? "+" : ""}{outcome.xpChange} XP
            </Text>
          )}
          {outcome.wisdomXpChange !== 0 && (
            <Text color={theme.colors.mana}>
              +{outcome.wisdomXpChange} Wisdom XP
            </Text>
          )}
          {outcome.shieldChange !== 0 && (
            <Text color={theme.colors.rare}>
              +{outcome.shieldChange} Streak Shield
            </Text>
          )}
          {outcome.evolutionBoost && (
            <Text color={theme.colors.epic}>Card evolution boosted!</Text>
          )}
        </Box>

        <Text dimColor italic>Press Enter to continue...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.mana}>
          === RANDOM EVENT ===
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold color={theme.colors.warning}>
          {event.title}
        </Text>
        <Text>{event.description}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {event.choices.map((choice, idx) => (
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
