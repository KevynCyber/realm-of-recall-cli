import React from "react";
import { Box, Text } from "ink";
import { useGameTheme } from "./ThemeProvider.js";

interface Props {
  playerName: string;
  streakDays: number;
  dayCount: number;
  streakAtRisk: boolean;
}

export function Header({ playerName, streakDays, dayCount, streakAtRisk }: Props) {
  const theme = useGameTheme();

  return (
    <Box
      borderStyle="single"
      borderColor={theme.borders.normal}
      justifyContent="space-between"
      paddingX={1}
    >
      <Text bold color={theme.colors.rare}>
        Realm of Recall
      </Text>
      <Text>
        Day {dayCount}
      </Text>
      <Box>
        {streakDays > 0 ? (
          <Text color={streakAtRisk ? theme.colors.warning : theme.colors.streakFire}>
            * {streakDays} day streak
          </Text>
        ) : (
          <Text color={theme.colors.muted}>No streak</Text>
        )}
      </Box>
    </Box>
  );
}
