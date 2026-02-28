import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";

interface Props {
  cardsDue: number;
  streakAtRisk: boolean;
  onNavigate: (screen: string) => void;
}

const MENU_ITEMS = [
  { key: "1", label: "Adventure", description: "Enter a zone and battle enemies", screen: "combat" },
  { key: "2", label: "Quick Review", description: "Review due cards without combat", screen: "review" },
  { key: "3", label: "Inventory", description: "Manage your equipment", screen: "inventory" },
  { key: "4", label: "World Map", description: "View zone progression", screen: "map" },
  { key: "5", label: "Import Deck", description: "Add new flashcard decks", screen: "import" },
  { key: "6", label: "Stats", description: "View your statistics", screen: "stats" },
] as const;

export function HubScreen({ cardsDue, streakAtRisk, onNavigate }: Props) {
  const theme = useGameTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => (i > 0 ? i - 1 : MENU_ITEMS.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => (i < MENU_ITEMS.length - 1 ? i + 1 : 0));
    } else if (key.return) {
      onNavigate(MENU_ITEMS[selectedIndex].screen);
    } else {
      const num = parseInt(input, 10);
      if (num >= 1 && num <= MENU_ITEMS.length) {
        onNavigate(MENU_ITEMS[num - 1].screen);
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" flexDirection="column" paddingX={1}>
        <Text bold>Realm of Recall</Text>
        <Box marginTop={1} flexDirection="column">
          {MENU_ITEMS.map((item, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Text key={item.screen}>
                <Text bold={isSelected}>
                  {isSelected ? "> " : "  "}[{item.key}] {item.label}
                </Text>
                <Text color={theme.colors.muted}>
                  {" — "}{item.description}
                </Text>
              </Text>
            );
          })}
        </Box>
      </Box>

      {cardsDue > 0 && (
        <Box marginTop={1} paddingX={1}>
          <Text color={theme.colors.warning}>
            {cardsDue} cards due today
          </Text>
        </Box>
      )}

      {streakAtRisk && (
        <Box paddingX={1}>
          <Text color={theme.colors.damage}>
            Your streak is at risk! Study today to keep it.
          </Text>
        </Box>
      )}
    </Box>
  );
}
