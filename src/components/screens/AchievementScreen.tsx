import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";
import { ACHIEVEMENTS, getAchievementsByCategory } from "../../core/progression/Achievements.js";
import type { AchievementCategory } from "../../core/progression/Achievements.js";

interface Props {
  unlockedKeys: Set<string>;
  onBack: () => void;
}

const CATEGORIES: { key: AchievementCategory; label: string }[] = [
  { key: "learning", label: "Learning" },
  { key: "combat", label: "Combat" },
  { key: "progression", label: "Progression" },
  { key: "exploration", label: "Exploration" },
];

// Flatten achievements into a scrollable list with category header entries.
interface HeaderEntry {
  type: "header";
  category: AchievementCategory;
  label: string;
}

interface AchievementEntry {
  type: "achievement";
  key: string;
  title: string;
  description: string;
  unlocked: boolean;
}

type ListEntry = HeaderEntry | AchievementEntry;

function buildList(unlockedKeys: Set<string>): ListEntry[] {
  const entries: ListEntry[] = [];
  for (const { key, label } of CATEGORIES) {
    entries.push({ type: "header", category: key, label });
    for (const achievement of getAchievementsByCategory(key)) {
      entries.push({
        type: "achievement",
        key: achievement.key,
        title: achievement.title,
        description: achievement.description,
        unlocked: unlockedKeys.has(achievement.key),
      });
    }
  }
  return entries;
}

export function AchievementScreen({ unlockedKeys, onBack }: Props) {
  const theme = useGameTheme();
  const totalCount = ACHIEVEMENTS.length;
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedKeys.has(a.key)).length;

  const list = buildList(unlockedKeys);

  // selectedIndex tracks only achievement rows (skipping headers) for navigation.
  const achievementIndices = list.reduce<number[]>((acc, entry, i) => {
    if (entry.type === "achievement") acc.push(i);
    return acc;
  }, []);

  const [selectedAchIdx, setSelectedAchIdx] = useState(0);

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.upArrow) {
      setSelectedAchIdx((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelectedAchIdx((prev) => Math.min(achievementIndices.length - 1, prev + 1));
    }
  });

  const selectedListIndex =
    achievementIndices.length > 0 ? achievementIndices[selectedAchIdx] : -1;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor={theme.colors.gold} paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.gold}>
          Achievements{"  "}
        </Text>
        <Text color={theme.colors.xp}>
          {unlockedCount}/{totalCount} Unlocked
        </Text>
      </Box>

      {/* Achievement list */}
      <Box
        borderStyle="single"
        borderColor={theme.colors.muted}
        flexDirection="column"
        paddingX={1}
        marginBottom={1}
      >
        {list.map((entry, i) => {
          if (entry.type === "header") {
            return (
              <Box key={`header-${entry.category}`} marginTop={i === 0 ? 0 : 1}>
                <Text bold color={theme.colors.rare}>
                  -- {entry.label} --
                </Text>
              </Box>
            );
          }

          const isSelected = i === selectedListIndex;

          if (entry.unlocked) {
            return (
              <Box key={entry.key} paddingLeft={1}>
                <Text color={theme.colors.success}>
                  {isSelected ? "> " : "  "}
                </Text>
                <Text color={theme.colors.success}>{"\u2713 "}</Text>
                <Text bold color={theme.colors.success}>
                  {entry.title}
                </Text>
                <Text color={theme.colors.success}>{" — "}</Text>
                <Text color={theme.colors.success}>{entry.description}</Text>
              </Box>
            );
          }

          return (
            <Box key={entry.key} paddingLeft={1}>
              <Text color={theme.colors.muted}>
                {isSelected ? "> " : "  "}
              </Text>
              <Text dimColor>{"\uD83D\uDD12 "}</Text>
              <Text bold dimColor>
                {entry.title}
              </Text>
              <Text dimColor>{" — "}</Text>
              <Text dimColor>{entry.description}</Text>
            </Box>
          );
        })}
      </Box>

      {/* Navigation hint */}
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>
          <Text bold>{"\u2191"}</Text>/<Text bold>{"\u2193"}</Text> scroll{"  "}
          <Text bold>Esc</Text> go back
        </Text>
      </Box>
    </Box>
  );
}
