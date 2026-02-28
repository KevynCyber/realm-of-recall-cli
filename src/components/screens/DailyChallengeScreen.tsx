import React from "react";
import { Box, Text, useInput } from "ink";
import type { Enemy } from "../../types/combat.js";
import { useGameTheme } from "../app/ThemeProvider.js";
import { EnemyDisplay } from "../combat/EnemyDisplay.js";
import { getDailySeed } from "../../core/combat/DailyChallenge.js";

interface Props {
  config: {
    enemy: Enemy;
    cardIds: string[];
    bonusGoldMultiplier: number;
    bonusXpMultiplier: number;
  };
  alreadyCompleted: boolean;
  previousScore: number;
  onStartChallenge: () => void;
  onBack: () => void;
}

function formatMultiplier(value: number): string {
  // Show "2x" for whole numbers, "1.5x" for decimals
  return Number.isInteger(value) ? `${value}x` : `${value}x`;
}

export function DailyChallengeScreen({
  config,
  alreadyCompleted,
  previousScore,
  onStartChallenge,
  onBack,
}: Props) {
  const theme = useGameTheme();
  const todaysSeed = getDailySeed();

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.return && !alreadyCompleted) {
      onStartChallenge();
    }
  });

  const goldLabel = formatMultiplier(config.bonusGoldMultiplier);
  const xpLabel = formatMultiplier(config.bonusXpMultiplier);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* ── Title ── */}
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Text bold color={theme.colors.warning}>
          Daily Challenge
        </Text>
        <Text color={theme.colors.muted}>{todaysSeed}</Text>
      </Box>

      {/* ── Enemy info ── */}
      <Box
        flexDirection="column"
        alignItems="center"
        borderStyle="single"
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <EnemyDisplay enemy={config.enemy} />
        <Box marginTop={1}>
          <Text>
            <Text dimColor>ATK </Text>
            <Text bold color={theme.colors.damage}>
              {config.enemy.attack}
            </Text>
          </Text>
        </Box>
      </Box>

      {/* ── Bonus multipliers ── */}
      <Box
        flexDirection="row"
        justifyContent="center"
        marginBottom={1}
        gap={3}
      >
        <Text>
          <Text dimColor>Bonus: </Text>
          <Text bold color={theme.colors.gold}>
            {goldLabel} Gold
          </Text>
          <Text dimColor>, </Text>
          <Text bold color={theme.colors.xp}>
            {xpLabel} XP
          </Text>
        </Text>
      </Box>

      {/* ── Card count ── */}
      <Box flexDirection="row" justifyContent="center" marginBottom={1}>
        <Text>
          <Text dimColor>Cards in challenge: </Text>
          <Text bold>{config.cardIds.length}</Text>
        </Text>
      </Box>

      {/* ── Completed / Start ── */}
      {alreadyCompleted ? (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Box
            borderStyle="round"
            paddingX={3}
            paddingY={1}
            flexDirection="column"
            alignItems="center"
          >
            <Text bold color={theme.colors.success}>
              Challenge Complete!
            </Text>
            <Box marginTop={1} flexDirection="column" alignItems="center">
              <Text dimColor>Your score</Text>
              <Text bold color={theme.colors.warning}>
                {previousScore}
              </Text>
            </Box>
          </Box>
          <Box marginTop={1}>
            <Text dimColor italic>
              Come back tomorrow!
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Esc to go back</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Box
            borderStyle="round"
            paddingX={3}
            paddingY={1}
          >
            <Text bold color={theme.colors.success}>
              Press Enter to begin
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Esc to go back</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
