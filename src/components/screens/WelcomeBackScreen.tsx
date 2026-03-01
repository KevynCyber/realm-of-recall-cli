import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";
import type { BacklogSessionOption } from "../../core/backlog/BacklogManager.js";
import { getWelcomeBackMessage } from "../../core/backlog/BacklogManager.js";

interface Props {
  daysSinceLastReview: number;
  overdueCount: number;
  onSelectOption: (option: BacklogSessionOption) => void;
}

const SESSION_OPTIONS: {
  key: string;
  option: BacklogSessionOption;
  label: string;
  description: string;
}[] = [
  {
    key: "1",
    option: "quick",
    label: "Quick Catch-Up",
    description: "10 easiest overdue cards (highest stability)",
  },
  {
    key: "2",
    option: "normal",
    label: "Normal Session",
    description: "20 overdue cards",
  },
  {
    key: "3",
    option: "full",
    label: "Full Review",
    description: "All overdue cards",
  },
];

export function WelcomeBackScreen({
  daysSinceLastReview,
  overdueCount,
  onSelectOption,
}: Props) {
  const theme = useGameTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => (i > 0 ? i - 1 : SESSION_OPTIONS.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) =>
        i < SESSION_OPTIONS.length - 1 ? i + 1 : 0,
      );
    } else if (key.return) {
      onSelectOption(SESSION_OPTIONS[selectedIndex].option);
    } else if (input === "1") {
      onSelectOption("quick");
    } else if (input === "2") {
      onSelectOption("normal");
    } else if (input === "3") {
      onSelectOption("full");
    }
  });

  const message = getWelcomeBackMessage(daysSinceLastReview, overdueCount);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.mana}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Text bold color={theme.colors.mana}>
          Welcome Back!
        </Text>
        <Box marginTop={1}>
          <Text>{message}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.colors.muted}>
            Days since last review:{" "}
            <Text bold color={theme.colors.warning}>
              {daysSinceLastReview}
            </Text>
          </Text>
          <Text color={theme.colors.muted}>
            Overdue cards:{" "}
            <Text bold color={theme.colors.warning}>
              {overdueCount}
            </Text>
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column">
        <Text bold>Choose how to ease back in:</Text>
        <Box flexDirection="column" marginTop={1}>
          {SESSION_OPTIONS.map((opt, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={opt.option} marginBottom={i < SESSION_OPTIONS.length - 1 ? 1 : 0}>
                <Text bold={isSelected} color={isSelected ? "cyan" : "white"}>
                  {isSelected ? "> " : "  "}[{opt.key}] {opt.label}
                </Text>
                <Text color={theme.colors.muted}>{" — "}{opt.description}</Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.colors.muted} italic>
          Use arrow keys to navigate, number keys or Enter to select
        </Text>
      </Box>
    </Box>
  );
}
