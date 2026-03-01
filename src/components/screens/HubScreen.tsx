import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";

interface Props {
  cardsDue: number;
  streakAtRisk: boolean;
  newCardsRemaining: number;
  idleBanner?: string | null;
  onNavigate: (screen: string) => void;
}

const MENU_ITEMS = [
  { key: "1", label: "Adventure", description: "Enter a zone and battle enemies", screen: "combat" },
  { key: "2", label: "Quick Review", description: "Review due cards without combat", screen: "review" },
  { key: "3", label: "Dungeon Run", description: "5-floor gauntlet with random events", screen: "dungeon" },
  { key: "4", label: "Daily Challenge", description: "Today's seeded challenge", screen: "daily_challenge" },
  { key: "5", label: "Inventory", description: "Manage your equipment", screen: "inventory" },
  { key: "6", label: "World Map", description: "View zone progression", screen: "map" },
  { key: "7", label: "Achievements", description: "Track your accomplishments", screen: "achievements" },
  { key: "8", label: "Stats", description: "View your statistics", screen: "stats" },
  { key: "9", label: "Manage Decks", description: "Toggle active decks for reviews", screen: "decks" },
  { key: "0", label: "Create Cards", description: "Author new flashcards", screen: "create_cards" },
] as const;

export function HubScreen({ cardsDue, streakAtRisk, newCardsRemaining, idleBanner, onNavigate }: Props) {
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
      {idleBanner && (
        <Box paddingX={1} marginBottom={1}>
          <Text color={theme.colors.gold}>{idleBanner}</Text>
        </Box>
      )}
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

      <Box paddingX={1}>
        <Text color={theme.colors.mana}>
          {newCardsRemaining} new cards remaining today
        </Text>
      </Box>

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
