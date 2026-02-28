import React from "react";

export interface GameTheme {
  colors: {
    damage: string;
    healing: string;
    xp: string;
    gold: string;
    mana: string;
    rare: string;
    epic: string;
    streakFire: string;
    muted: string;
    success: string;
    warning: string;
    error: string;
  };
  borders: {
    normal: string;
    combat: string;
    rare: string;
  };
  rarityColors: {
    common: string;
    uncommon: string;
    rare: string;
    epic: string;
  };
}

export const DEFAULT_THEME: GameTheme = {
  colors: {
    damage: "#ff3366",
    healing: "#00ff88",
    xp: "#9b59b6",
    gold: "#ffd700",
    mana: "#00d4ff",
    rare: "#00d4ff",
    epic: "#ff6bff",
    streakFire: "#ff6b35",
    muted: "#666666",
    success: "#00ff88",
    warning: "#ffd700",
    error: "#ff3366",
  },
  borders: {
    normal: "single",
    combat: "double",
    rare: "round",
  },
  rarityColors: {
    common: "white",
    uncommon: "#00ff88",
    rare: "#00d4ff",
    epic: "#ff6bff",
  },
};

const GameThemeContext = React.createContext<GameTheme>(DEFAULT_THEME);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <GameThemeContext.Provider value={DEFAULT_THEME}>
      {children}
    </GameThemeContext.Provider>
  );
}

export function useGameTheme(): GameTheme {
  return React.useContext(GameThemeContext);
}
