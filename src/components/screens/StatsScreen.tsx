import React from "react";
import { Box, Text, useInput } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";
import type { Player } from "../../types/player.js";
import { xpToNextLevel } from "../../core/progression/XPCalculator.js";
import { getStreakBonus, getStreakTitle } from "../../core/progression/StreakTracker.js";
import type { TrendResult } from "../../core/analytics/MarginalGains.js";

interface DeckStat {
  name: string;
  total: number;
  mastered: number;
  accuracy: number;
}

interface FsrsStats {
  newCount: number;
  learningCount: number;
  reviewCount: number;
  relearnCount: number;
}

interface Props {
  player: Player;
  deckStats: DeckStat[];
  fsrsStats: FsrsStats;
  onBack: () => void;
  // Ultra-learner props (all optional for backward compat)
  accuracyTrend?: TrendResult;
  speedTrend?: TrendResult;
  consistencyGrid?: string;
  wisdomXp?: number;
}

function XPProgressBar({ xp, xpNeeded, color }: { xp: number; xpNeeded: number; color: string }) {
  const barWidth = 20;
  const filled = xpNeeded > 0 ? Math.min(barWidth, Math.round((xp / xpNeeded) * barWidth)) : 0;
  const empty = barWidth - filled;

  return (
    <Text>
      <Text color={color}>{"[" + "=".repeat(filled) + " ".repeat(empty) + "]"}</Text>
      <Text color={color}> {xp}/{xpNeeded} XP</Text>
    </Text>
  );
}

export function StatsScreen({
  player,
  deckStats,
  fsrsStats,
  onBack,
  accuracyTrend,
  speedTrend,
  consistencyGrid,
  wisdomXp,
}: Props) {
  const theme = useGameTheme();

  useInput((input, key) => {
    if (key.escape || input === "b") {
      onBack();
    }
  });

  const xpNeeded = xpToNextLevel(player.level);
  const totalCombats = player.combatWins + player.combatLosses;
  const winRate = totalCombats > 0 ? Math.round((player.combatWins / totalCombats) * 100) : 0;
  const accuracy =
    player.totalReviews > 0
      ? Math.round((player.totalCorrect / player.totalReviews) * 100)
      : 0;
  const streakBonus = getStreakBonus(player.streakDays);
  const streakTitle = getStreakTitle(player.streakDays);

  const trendArrow = (trend: string) =>
    trend === "improving" ? "\u2191" : trend === "declining" ? "\u2193" : "\u2192";

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor={theme.colors.rare} paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.rare}>
          Player Statistics
        </Text>
      </Box>

      {/* Section 1 — Player Info */}
      <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.gold}>
          {player.name} the {player.class}
        </Text>
        <Text>Level {player.level}</Text>
        <XPProgressBar xp={player.xp} xpNeeded={xpNeeded} color={theme.colors.xp} />
      </Box>

      {/* Section 2 — Combat Record */}
      <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.damage}>
          Combat Record
        </Text>
        <Text>
          Wins: <Text color={theme.colors.success}>{player.combatWins}</Text>
          {"  "}Losses: <Text color={theme.colors.error}>{player.combatLosses}</Text>
          {"  "}Win Rate: <Text bold>{winRate}%</Text>
        </Text>
      </Box>

      {/* Section 3 — Study Stats */}
      <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.xp}>
          Study Stats
        </Text>
        <Text>Total Reviews: {player.totalReviews}</Text>
        <Text>Accuracy: {accuracy}%</Text>
        <Text>
          New: <Text color={theme.colors.mana}>{fsrsStats.newCount}</Text>
          {"  "}Learning: <Text color={theme.colors.warning}>{fsrsStats.learningCount}</Text>
          {"  "}Review: <Text color={theme.colors.success}>{fsrsStats.reviewCount}</Text>
          {"  "}Relearning: <Text color={theme.colors.error}>{fsrsStats.relearnCount}</Text>
        </Text>
      </Box>

      {/* Section 4 — Streaks */}
      <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.streakFire}>
          Streaks
        </Text>
        <Text>
          Current Streak: <Text color={theme.colors.streakFire}>{player.streakDays} days</Text>
          {player.streakDays > 0 ? <Text> {"\uD83D\uDD25"}</Text> : null}
        </Text>
        <Text>Longest Streak: {player.longestStreak} days</Text>
        <Text>
          Streak Bonus: <Text color={theme.colors.xp}>+{streakBonus}% XP</Text>
        </Text>
        <Text>
          Title: <Text bold>{streakTitle}</Text>
        </Text>
      </Box>

      {/* Section 5 — Deck Breakdown */}
      <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.mana}>
          Deck Breakdown
        </Text>
        {deckStats.length === 0 ? (
          <Text color={theme.colors.muted}>No decks imported yet.</Text>
        ) : (
          deckStats.map((deck) => (
            <Text key={deck.name}>
              {deck.name}: {deck.mastered}/{deck.total} mastered ({deck.accuracy}%)
            </Text>
          ))
        )}
      </Box>

      {/* Section 6 — Progress Trends (Ultra-Learner) */}
      {accuracyTrend && (
        <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
          <Text bold color={theme.colors.xp}>
            Progress Trends
          </Text>
          <Text>
            Accuracy: {accuracyTrend.sparkline} {trendArrow(accuracyTrend.trend)}{" "}
            {Math.abs(accuracyTrend.percentChange).toFixed(1)}%
          </Text>
          {speedTrend && (
            <Text>
              Speed:    {speedTrend.sparkline} {trendArrow(speedTrend.trend)}{" "}
              {Math.abs(speedTrend.percentChange).toFixed(1)}%
            </Text>
          )}
        </Box>
      )}

      {/* Section 7 — Consistency (Ultra-Learner) */}
      {consistencyGrid && (
        <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
          <Text bold color={theme.colors.streakFire}>
            Consistency
          </Text>
          <Text>{consistencyGrid}</Text>
        </Box>
      )}

      {/* Section 8 — Wisdom (Ultra-Learner) */}
      {wisdomXp !== undefined && wisdomXp > 0 && (
        <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
          <Text bold color="magenta">
            Wisdom
          </Text>
          <Text>
            Wisdom XP: <Text color="magenta">{wisdomXp}</Text>
          </Text>
        </Box>
      )}

      {/* Navigation hint */}
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>
          Press <Text bold>Esc</Text> or <Text bold>b</Text> to go back
        </Text>
      </Box>
    </Box>
  );
}
