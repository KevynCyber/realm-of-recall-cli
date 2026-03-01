import React from "react";
import { Box, Text, useInput } from "ink";
import type { Enemy } from "../../types/combat.js";
import { EnemyDisplay } from "./EnemyDisplay.js";
import { useGameTheme } from "../app/ThemeProvider.js";

export interface PreviewData {
  avgDifficulty: number;
  deckNames: string;
  xpReward: number;
  goldReward: number;
}

interface Props {
  enemy: Enemy;
  cardCount: number;
  previewData: PreviewData;
  isDungeonFloor?: boolean;
  onFight: () => void;
  onRetreat?: () => void;
}

function getDifficultyLabel(avg: number): string {
  if (avg <= 3) return "Easy";
  if (avg <= 6) return "Medium";
  return "Hard";
}

export function EncounterPreview({
  enemy,
  cardCount,
  previewData,
  isDungeonFloor,
  onFight,
  onRetreat,
}: Props) {
  const theme = useGameTheme();

  useInput((_input, key) => {
    if (key.return) {
      onFight();
    } else if (key.escape && !isDungeonFloor && onRetreat) {
      onRetreat();
    }
  });

  const diffLabel = getDifficultyLabel(previewData.avgDifficulty);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginY={1} flexDirection="column" alignItems="center">
        <EnemyDisplay enemy={enemy} />
      </Box>
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
        <Text bold color={theme.colors.warning}>Encounter Preview</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>
            <Text bold>Enemy: </Text>
            <Text>{enemy.name}</Text>
            <Text dimColor> ({enemy.tier})</Text>
          </Text>
          <Text>
            <Text bold>HP: </Text>
            <Text>{enemy.maxHp}</Text>
          </Text>
          <Text>
            <Text bold>Difficulty: </Text>
            <Text>{diffLabel} ({previewData.avgDifficulty})</Text>
          </Text>
          <Text>
            <Text bold>Deck: </Text>
            <Text>{previewData.deckNames}</Text>
          </Text>
          <Text>
            <Text bold>Cards: </Text>
            <Text>{cardCount}</Text>
          </Text>
          <Text>
            <Text bold>Rewards: </Text>
            <Text color={theme.colors.xp}>~{previewData.xpReward} XP</Text>
            {"  "}
            <Text color={theme.colors.gold}>~{previewData.goldReward} Gold</Text>
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text bold color="green">[Enter] Fight</Text>
        {isDungeonFloor ? (
          <Text bold color="red">No turning back!</Text>
        ) : (
          <Text bold color="yellow">[Escape] Retreat</Text>
        )}
      </Box>
    </Box>
  );
}
