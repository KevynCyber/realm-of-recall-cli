import React, { useState, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { ThemeProvider } from "./ThemeProvider.js";
import { Header } from "./Header.js";
import { StatusBar } from "./StatusBar.js";
import type { Player } from "../../types/index.js";

export type Screen =
  | "title"
  | "hub"
  | "combat"
  | "review"
  | "inventory"
  | "map"
  | "stats";

interface NavigationContextValue {
  navigate: (screen: Screen) => void;
  currentScreen: Screen;
}

export const NavigationContext = React.createContext<NavigationContextValue>({
  navigate: () => {},
  currentScreen: "title",
});

export function useNavigation(): NavigationContextValue {
  return React.useContext(NavigationContext);
}

export default function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>("title");
  const [player, setPlayer] = useState<Player | null>(null);
  const [cardsDue, setCardsDue] = useState(0);

  const navigate = useCallback((target: Screen) => {
    setScreen(target);
  }, []);

  useInput((input, key) => {
    if (screen === "title") return;

    if (input === "q") {
      exit();
      return;
    }

    if (key.escape) {
      setScreen("hub");
    }
  });

  const terminalHeight = process.stdout.rows || 24;

  const renderContent = () => {
    switch (screen) {
      case "title":
        return <Text>Screen: title</Text>;
      case "hub":
        return <Text>Screen: hub</Text>;
      case "combat":
        return <Text>Screen: combat</Text>;
      case "review":
        return <Text>Screen: review</Text>;
      case "inventory":
        return <Text>Screen: inventory</Text>;
      case "map":
        return <Text>Screen: map</Text>;
      case "stats":
        return <Text>Screen: stats</Text>;
      default:
        return <Text>Screen: unknown</Text>;
    }
  };

  return (
    <ThemeProvider>
      <NavigationContext.Provider value={{ navigate, currentScreen: screen }}>
        <Box flexDirection="column" minHeight={terminalHeight}>
          {player && (
            <Header
              playerName={player.name}
              streakDays={player.streakDays}
              dayCount={player.totalReviews}
              streakAtRisk={false}
            />
          )}
          <Box flexGrow={1}>{renderContent()}</Box>
          {player && <StatusBar player={player} cardsDue={cardsDue} />}
        </Box>
      </NavigationContext.Provider>
    </ThemeProvider>
  );
}
