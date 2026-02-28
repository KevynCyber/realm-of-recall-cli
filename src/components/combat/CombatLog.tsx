import React from "react";
import { Box, Text } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";
import type { CombatEvent, CombatAction } from "../../types/combat.js";

interface Props {
  events: CombatEvent[];
}

const PLAYER_ACTIONS: CombatAction[] = [
  "player_attack",
  "player_critical",
  "player_glancing",
];

function isPlayerAction(action: CombatAction): boolean {
  return PLAYER_ACTIONS.includes(action);
}

export function CombatLog({ events }: Props) {
  const theme = useGameTheme();
  const visible = events.slice(-6);

  if (visible.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color={theme.colors.muted}>(Combat begins...)</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {visible.map((event, i) => {
        const player = isPlayerAction(event.action);
        const prefix = player ? ">>" : "<<";
        const color = player ? theme.colors.success : theme.colors.damage;

        return (
          <Text key={i} color={color}>
            {prefix} {event.description}
          </Text>
        );
      })}
    </Box>
  );
}
