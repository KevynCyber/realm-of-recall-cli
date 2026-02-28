import React from "react";
import { Box, Text } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";
import { EnemyTier } from "../../types/combat.js";
import type { Enemy } from "../../types/combat.js";

interface Props {
  enemy: Enemy;
}

const ASCII_ART: Record<EnemyTier, [string, string, string]> = {
  [EnemyTier.Minion]: ["  o  ", " /|\\ ", " / \\ "],
  [EnemyTier.Common]: [" \\o/ ", "  |  ", " / \\ "],
  [EnemyTier.Elite]: [" [o] ", " /|\\ ", " _/ \\_ "],
  [EnemyTier.Boss]: [" /V\\ ", "<[O]>", " \\_|_/ "],
};

function getTierColor(tier: EnemyTier, theme: ReturnType<typeof useGameTheme>): string {
  switch (tier) {
    case EnemyTier.Minion:
      return theme.colors.muted;
    case EnemyTier.Common:
      return "white";
    case EnemyTier.Elite:
      return theme.colors.mana;
    case EnemyTier.Boss:
      return theme.colors.damage;
  }
}

function getHpColor(hp: number, maxHp: number): string {
  const ratio = hp / maxHp;
  if (ratio > 0.5) return "green";
  if (ratio > 0.25) return "yellow";
  return "red";
}

export function EnemyDisplay({ enemy }: Props) {
  const theme = useGameTheme();
  const tierColor = getTierColor(enemy.tier, theme);
  const hpColor = getHpColor(enemy.hp, enemy.maxHp);
  const art = ASCII_ART[enemy.tier];

  const barWidth = 20;
  const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  const filled = Math.round(ratio * barWidth);
  const empty = barWidth - filled;

  return (
    <Box flexDirection="column" alignItems="center">
      <Text>
        <Text bold>{enemy.name}</Text>
        <Text color={tierColor}> ({enemy.tier})</Text>
      </Text>
      {art.map((line, i) => (
        <Text key={i} color={tierColor}>
          {line}
        </Text>
      ))}
      <Text>
        <Text color={hpColor}>{"█".repeat(filled)}</Text>
        <Text color="gray">{"░".repeat(empty)}</Text>
        <Text> HP {enemy.hp}/{enemy.maxHp}</Text>
      </Text>
    </Box>
  );
}
