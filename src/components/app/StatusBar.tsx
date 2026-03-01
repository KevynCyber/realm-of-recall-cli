import React from "react";
import { Box, Text } from "ink";
import { useGameTheme } from "./ThemeProvider.js";
import { xpToNextLevel } from "../../core/progression/XPCalculator.js";
import type { Player } from "../../types/index.js";

interface Props {
  player: Player;
  cardsDue: number;
  breakWarning?: string;
}

function hpBarColor(hp: number, maxHp: number): string {
  const pct = hp / maxHp;
  if (pct > 0.5) return "green";
  if (pct > 0.25) return "yellow";
  return "red";
}

function renderBar(current: number, max: number, width: number): string {
  const filled = Math.round((current / max) * width);
  const empty = width - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

export function StatusBar({ player, cardsDue, breakWarning }: Props) {
  const theme = useGameTheme();
  const xpNeeded = xpToNextLevel(player.level);
  const barWidth = 10;
  const hpColor = hpBarColor(player.hp, player.maxHp);

  return (
    <Box
      borderStyle="single"
      borderColor={theme.borders.normal}
      paddingX={1}
      justifyContent="space-between"
    >
      <Text>
        Lv.{player.level} {player.class}
      </Text>
      <Text>
        HP <Text color={hpColor}>{renderBar(player.hp, player.maxHp, barWidth)}</Text>{" "}
        {player.hp}/{player.maxHp}
      </Text>
      <Text color={theme.colors.xp}>
        XP {player.xp}/{xpNeeded}
      </Text>
      <Text color={theme.colors.gold}>
        Gold: {player.gold}
      </Text>
      <Text>
        Due: {cardsDue}
      </Text>
      {breakWarning && (
        <Text color={theme.colors.warning} dimColor>
          {breakWarning}
        </Text>
      )}
    </Box>
  );
}
