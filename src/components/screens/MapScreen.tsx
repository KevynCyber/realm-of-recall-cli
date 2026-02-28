import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";
import { ProgressBar } from "../common/ProgressBar.js";
import type { Zone } from "../../types/index.js";

interface ZoneInfo {
  zone: Zone;
  total: number;
  mastered: number;
  masteryPct: number;
  isUnlocked: boolean;
}

interface Props {
  zones: ZoneInfo[];
  onSelectZone: (zoneId: string) => void;
  onBack: () => void;
}

const STATUS_CLEARED = "\u2713"; // checkmark
const STATUS_IN_PROGRESS = "\u25C6"; // diamond
const STATUS_LOCKED = "\u25CB"; // circle

function getStatusIcon(zone: Zone, isUnlocked: boolean): string {
  if (zone.bossDefeated) return STATUS_CLEARED;
  if (isUnlocked) return STATUS_IN_PROGRESS;
  return STATUS_LOCKED;
}

function getStatusColor(zone: Zone, isUnlocked: boolean, theme: ReturnType<typeof useGameTheme>): string {
  if (zone.bossDefeated) return theme.colors.success;
  if (isUnlocked) return theme.colors.warning;
  return theme.colors.muted;
}

export function MapScreen({ zones, onSelectZone, onBack }: Props) {
  const theme = useGameTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);

  useInput((input, key) => {
    if (key.escape || input === "b") {
      onBack();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((i) => (i > 0 ? i - 1 : zones.length - 1));
      setLockedMessage(null);
    } else if (key.downArrow) {
      setSelectedIndex((i) => (i < zones.length - 1 ? i + 1 : 0));
      setLockedMessage(null);
    } else if (key.return) {
      const selected = zones[selectedIndex];
      if (selected.isUnlocked) {
        onSelectZone(selected.zone.id);
      } else {
        setLockedMessage("Zone is locked");
        setTimeout(() => setLockedMessage(null), 1500);
      }
    }
  });

  const selected = zones[selectedIndex];

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" flexDirection="column" paddingX={1}>
        <Text bold>World Map</Text>

        <Box marginTop={1} flexDirection="column">
          {zones.map((zi, i) => {
            const isSelected = i === selectedIndex;
            const icon = getStatusIcon(zi.zone, zi.isUnlocked);
            const iconColor = getStatusColor(zi.zone, zi.isUnlocked, theme);
            const textColor = zi.isUnlocked ? undefined : theme.colors.muted;

            return (
              <Box key={zi.zone.id} flexDirection="column">
                {/* Zone row */}
                <Box>
                  <Text bold={isSelected} color={textColor}>
                    {isSelected ? "> " : "  "}[{zi.zone.name}]
                  </Text>
                  <Text color={iconColor}> {icon}</Text>
                </Box>

                {/* Mastery bar */}
                <Box marginLeft={4}>
                  {zi.isUnlocked ? (
                    <Text>
                      <ProgressBar
                        value={zi.masteryPct / 100}
                        width={12}
                        filledColor={theme.colors.xp}
                      />{" "}
                      <Text>{zi.masteryPct}%</Text>
                    </Text>
                  ) : (
                    <Text color={theme.colors.muted}>Locked</Text>
                  )}
                </Box>

                {/* Connector line between zones */}
                {i < zones.length - 1 && (
                  <Box marginLeft={4}>
                    <Text color={theme.colors.muted}>|</Text>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Detail panel for selected zone */}
      {selected && (
        <Box marginTop={1} borderStyle="single" flexDirection="column" paddingX={1}>
          <Text bold>{selected.zone.name}</Text>
          <Text>
            <Text color={theme.colors.muted}>Deck: </Text>
            <Text>{selected.zone.deckId}</Text>
          </Text>
          <Text>
            <Text color={theme.colors.muted}>Cards: </Text>
            <Text>{selected.total} total, {selected.mastered} mastered</Text>
          </Text>
          <Text>
            <Text color={theme.colors.muted}>Mastery: </Text>
            <Text>{selected.masteryPct}% / {selected.zone.requiredMastery * 100}% required</Text>
          </Text>
          <Text>
            <Text color={theme.colors.muted}>Boss: </Text>
            {selected.zone.bossDefeated ? (
              <Text color={theme.colors.success}>Defeated</Text>
            ) : selected.masteryPct >= selected.zone.requiredMastery * 100 ? (
              <Text color={theme.colors.warning}>Available!</Text>
            ) : (
              <Text color={theme.colors.muted}>Locked</Text>
            )}
          </Text>
        </Box>
      )}

      {/* Locked zone message */}
      {lockedMessage && (
        <Box marginTop={1} paddingX={1}>
          <Text color={theme.colors.error}>{lockedMessage}</Text>
        </Box>
      )}

      {/* Navigation hint */}
      <Box marginTop={1} paddingX={1}>
        <Text color={theme.colors.muted}>
          Up/Down: navigate | Enter: select | b/Esc: back
        </Text>
      </Box>
    </Box>
  );
}
