import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";
import type { Deck } from "../../types/index.js";

interface DeckInfo {
  deck: Deck;
  cardCount: number;
  dueCount: number;
  suspendedCount: number;
}

interface Props {
  decks: DeckInfo[];
  onToggle: (deckId: string) => void;
  onUnsuspendAll: (deckId: string) => void;
  onBack: () => void;
}

export function DeckScreen({ decks, onToggle, onUnsuspendAll, onBack }: Props) {
  const theme = useGameTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => (i > 0 ? i - 1 : decks.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => (i < decks.length - 1 ? i + 1 : 0));
    } else if (input === " " || key.return) {
      const deck = decks[selectedIndex];
      if (!deck) return;
      // Prevent unequipping the last equipped deck
      const equippedCount = decks.filter((d) => d.deck.equipped).length;
      if (deck.deck.equipped && equippedCount <= 1) return;
      onToggle(deck.deck.id);
    } else if (input === "u" || input === "U") {
      const deck = decks[selectedIndex];
      if (deck && deck.suspendedCount > 0) {
        onUnsuspendAll(deck.deck.id);
      }
    } else if (key.escape || input === "b") {
      onBack();
    }
  });

  const equippedCount = decks.filter((d) => d.deck.equipped).length;
  const totalSuspended = decks.reduce((sum, d) => sum + d.suspendedCount, 0);

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" flexDirection="column" paddingX={1}>
        <Text bold>Manage Decks</Text>
        <Text color={theme.colors.muted}>
          Toggle which decks are active for reviews and hub combat.
        </Text>
        <Box marginTop={1} flexDirection="column">
          {decks.map((info, i) => {
            const isSelected = i === selectedIndex;
            const checkbox = info.deck.equipped ? "[x]" : "[ ]";
            return (
              <Text key={info.deck.id}>
                <Text bold={isSelected}>
                  {isSelected ? "> " : "  "}{checkbox} {info.deck.name}
                </Text>
                <Text color={theme.colors.muted}>
                  {" "}({info.cardCount} cards, {info.dueCount} due)
                </Text>
                {info.suspendedCount > 0 && (
                  <Text color="yellow">
                    {" "}{info.suspendedCount} suspended
                  </Text>
                )}
              </Text>
            );
          })}
        </Box>
      </Box>

      {/* Suspended Cards section */}
      {totalSuspended > 0 && (
        <Box borderStyle="round" borderColor="yellow" flexDirection="column" paddingX={1} marginTop={1}>
          <Text bold color="yellow">Suspended Cards</Text>
          <Text color={theme.colors.muted}>
            {totalSuspended} card{totalSuspended !== 1 ? "s" : ""} suspended across all decks
          </Text>
          {decks[selectedIndex]?.suspendedCount > 0 && (
            <Text dimColor italic>
              Press [U] to unsuspend all in {decks[selectedIndex].deck.name}
            </Text>
          )}
        </Box>
      )}

      <Box marginTop={1} paddingX={1} flexDirection="column">
        <Text color={theme.colors.muted}>
          {equippedCount}/{decks.length} decks equipped
        </Text>
        <Text dimColor italic>
          Space/Enter to toggle | {totalSuspended > 0 ? "[U] unsuspend all | " : ""}Esc/b to go back
        </Text>
      </Box>
    </Box>
  );
}
