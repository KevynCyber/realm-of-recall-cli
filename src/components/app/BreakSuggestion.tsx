import React from "react";
import { Box, Text, useInput } from "ink";
import { useGameTheme } from "./ThemeProvider.js";
import {
  formatSessionDuration,
  getBreakMessage,
} from "../../core/session/SessionGuardrails.js";

interface Props {
  sessionElapsedMs: number;
  cardsReviewed: number;
  onDismiss: () => void;
  onReturnToHub: () => void;
}

export function BreakSuggestion({
  sessionElapsedMs,
  cardsReviewed,
  onDismiss,
  onReturnToHub,
}: Props) {
  const theme = useGameTheme();

  useInput((input, key) => {
    if (input === "c" || key.escape) {
      onDismiss();
    } else if (input === "b" || key.return) {
      onReturnToHub();
    }
  });

  const message = getBreakMessage("hard");
  const duration = formatSessionDuration(sessionElapsedMs);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.warning}
      paddingX={2}
      paddingY={1}
      alignItems="center"
    >
      <Text bold color={theme.colors.warning}>
        Time for a Break?
      </Text>
      <Text> </Text>
      <Text>{message}</Text>
      <Text> </Text>
      <Text>
        Session duration: <Text bold>{duration}</Text>
      </Text>
      <Text>
        Cards reviewed: <Text bold>{cardsReviewed}</Text>
      </Text>
      <Text> </Text>
      <Text dimColor>
        [B] Take a break  [C] Continue studying
      </Text>
    </Box>
  );
}
