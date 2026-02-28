import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useGameTheme } from "../app/ThemeProvider.js";
import { PlayerClass } from "../../types/index.js";
import { CLASS_CONFIGS } from "../../core/player/ClassDefinitions.js";

interface Props {
  onCreatePlayer: (name: string, playerClass: PlayerClass) => void;
}

type Phase = "name" | "class" | "confirm";

const CLASS_OPTIONS: { key: string; value: PlayerClass; label: string; tagline: string }[] = [
  { key: "1", value: PlayerClass.Scholar, label: "Scholar", tagline: "Bonus XP (+20%), lower HP" },
  { key: "2", value: PlayerClass.Warrior, label: "Warrior", tagline: "High HP and attack" },
  { key: "3", value: PlayerClass.Rogue, label: "Rogue", tagline: "Better loot and gold (+25%)" },
];

export function TitleScreen({ onCreatePlayer }: Props) {
  const theme = useGameTheme();
  const [phase, setPhase] = useState<Phase>("name");
  const [name, setName] = useState("Hero");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedClass = CLASS_OPTIONS[selectedIndex].value;
  const selectedConfig = CLASS_CONFIGS[selectedClass];
  const selectedLabel = CLASS_OPTIONS[selectedIndex].label;

  useInput(
    (input, key) => {
      if (phase === "class") {
        if (key.upArrow) {
          setSelectedIndex((i) => (i > 0 ? i - 1 : CLASS_OPTIONS.length - 1));
        } else if (key.downArrow) {
          setSelectedIndex((i) => (i < CLASS_OPTIONS.length - 1 ? i + 1 : 0));
        } else if (input === "1") {
          setSelectedIndex(0);
          setPhase("confirm");
        } else if (input === "2") {
          setSelectedIndex(1);
          setPhase("confirm");
        } else if (input === "3") {
          setSelectedIndex(2);
          setPhase("confirm");
        } else if (key.return) {
          setPhase("confirm");
        } else if (key.escape) {
          setPhase("name");
        }
      } else if (phase === "confirm") {
        if (key.return) {
          onCreatePlayer(name, selectedClass);
        } else if (key.escape) {
          setPhase("class");
        }
      }
    },
    { isActive: phase !== "name" },
  );

  const handleNameSubmit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      setName(trimmed);
      setPhase("class");
    }
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Title */}
      <Box
        flexDirection="column"
        alignItems="center"
        borderStyle="double"
        borderColor={theme.colors.rare}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Text bold color={theme.colors.rare}>
          ____  ____    _    _     __  __    ___  _____   ____  _____ ____    _    _     _
        </Text>
        <Text bold color={theme.colors.rare}>
          |  _ \| ___|  / \  | |   |  \/  |  / _ \|  ___| |  _ \| ____/ ___|  / \  | |   | |
        </Text>
        <Text bold color={theme.colors.rare}>
          | |_) |  _|  / _ \ | |   | |\/| | | | | | |_    | |_) |  _|| |    / _ \ | |   | |
        </Text>
        <Text bold color={theme.colors.rare}>
          |  _ &lt;| |___ / ___ \| |___| |  | | | |_| |  _|   |  _ &lt;| |__| |___/ ___ \| |___| |___
        </Text>
        <Text bold color={theme.colors.rare}>
          |_| \_\_____/_/   \_\_____|_|  |_|  \___/|_|     |_| \_\_____\____/_/   \_\_____|_____|
        </Text>
        <Box marginTop={1}>
          <Text color={theme.colors.muted} italic>
            Learn through combat
          </Text>
        </Box>
      </Box>

      {/* Phase: Name Entry */}
      {phase === "name" && (
        <Box flexDirection="column">
          <Text bold>Enter your name:</Text>
          <Box marginTop={1}>
            <Text bold color={theme.colors.gold}>
              {"> "}
            </Text>
            <TextInput
              value={name}
              onChange={setName}
              onSubmit={handleNameSubmit}
            />
          </Box>
        </Box>
      )}

      {/* Phase: Class Selection */}
      {phase === "class" && (
        <Box flexDirection="column">
          <Text bold>
            Choose your class, <Text color={theme.colors.gold}>{name}</Text>:
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {CLASS_OPTIONS.map((opt, i) => {
              const config = CLASS_CONFIGS[opt.value];
              const isSelected = i === selectedIndex;
              return (
                <Box key={opt.value} marginBottom={i < CLASS_OPTIONS.length - 1 ? 1 : 0}>
                  <Text
                    color={isSelected ? "cyan" : "white"}
                    bold={isSelected}
                  >
                    {isSelected ? ">" : " "} [{opt.key}] {opt.label}
                  </Text>
                  <Text color={theme.colors.muted}>
                    {" "}- {opt.tagline}
                  </Text>
                  {isSelected && (
                    <Text color={theme.colors.muted} dimColor>
                      {"  "}HP:{config.baseHp} ATK:{config.baseAttack} DEF:{config.baseDefense} Crit:{config.critChancePct}%
                    </Text>
                  )}
                </Box>
              );
            })}
          </Box>
          <Box marginTop={1}>
            <Text color={theme.colors.muted} italic>
              Use arrow keys to navigate, number keys or Enter to select
            </Text>
          </Box>

          {/* Stats preview */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={theme.colors.muted}
            paddingX={1}
            marginTop={1}
          >
            <Text bold color="cyan">
              {CLASS_OPTIONS[selectedIndex].label} Stats
            </Text>
            <Text>
              <Text color={theme.colors.damage}>HP  </Text>
              <Text>{selectedConfig.baseHp}</Text>
            </Text>
            <Text>
              <Text color={theme.colors.streakFire}>ATK </Text>
              <Text>{selectedConfig.baseAttack}</Text>
            </Text>
            <Text>
              <Text color={theme.colors.mana}>DEF </Text>
              <Text>{selectedConfig.baseDefense}</Text>
            </Text>
            <Text>
              <Text color={theme.colors.gold}>Crit</Text>
              <Text> {selectedConfig.critChancePct}%</Text>
            </Text>
            {selectedConfig.xpBonusPct > 0 && (
              <Text>
                <Text color={theme.colors.xp}>XP  </Text>
                <Text>+{selectedConfig.xpBonusPct}%</Text>
              </Text>
            )}
            {selectedConfig.goldBonusPct > 0 && (
              <Text>
                <Text color={theme.colors.gold}>Gold</Text>
                <Text> +{selectedConfig.goldBonusPct}%</Text>
              </Text>
            )}
          </Box>
        </Box>
      )}

      {/* Phase: Confirm */}
      {phase === "confirm" && (
        <Box flexDirection="column">
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={theme.colors.success}
            paddingX={2}
            paddingY={1}
          >
            <Text bold>
              Create{" "}
              <Text color={theme.colors.gold}>{name}</Text>
              {" "}the{" "}
              <Text color="cyan">{selectedLabel}</Text>?
            </Text>
            <Box marginTop={1} flexDirection="column">
              <Text>
                <Text color={theme.colors.damage}>HP  </Text>
                <Text>{selectedConfig.baseHp}</Text>
                {"  "}
                <Text color={theme.colors.streakFire}>ATK </Text>
                <Text>{selectedConfig.baseAttack}</Text>
                {"  "}
                <Text color={theme.colors.mana}>DEF </Text>
                <Text>{selectedConfig.baseDefense}</Text>
                {"  "}
                <Text color={theme.colors.gold}>Crit </Text>
                <Text>{selectedConfig.critChancePct}%</Text>
              </Text>
            </Box>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.colors.success} bold>
              [Enter]
            </Text>
            <Text> Confirm  </Text>
            <Text color={theme.colors.warning} bold>
              [Esc]
            </Text>
            <Text> Go back</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
