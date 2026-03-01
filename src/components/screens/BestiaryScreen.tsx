import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";
import { EnemyTier } from "../../types/combat.js";
import { NAME_POOLS } from "../../core/combat/EnemyGenerator.js";
import type { EnemyEncounter } from "../../data/repositories/EnemyRepository.js";

export interface CollectionDeckStats {
  name: string;
  total: number;
  mastered: number;
}

interface Props {
  encounters: EnemyEncounter[];
  collectionStats: CollectionDeckStats[];
  onBack: () => void;
}

type TabKey = "enemies" | "collection";

const TIER_ORDER: EnemyTier[] = [
  EnemyTier.Minion,
  EnemyTier.Common,
  EnemyTier.Elite,
  EnemyTier.Boss,
];

const TIER_INT_MAP: Record<number, EnemyTier> = {
  0: EnemyTier.Minion,
  1: EnemyTier.Common,
  2: EnemyTier.Elite,
  3: EnemyTier.Boss,
};

const TIER_LABELS: Record<EnemyTier, string> = {
  [EnemyTier.Minion]: "Minion",
  [EnemyTier.Common]: "Common",
  [EnemyTier.Elite]: "Elite",
  [EnemyTier.Boss]: "Boss",
};

interface EnemyEntry {
  type: "header" | "enemy";
  tier: EnemyTier;
  name?: string;
  encountered?: boolean;
  timesDefeated?: number;
  firstEncounter?: string | null;
}

function buildEnemyList(encounters: EnemyEncounter[]): EnemyEntry[] {
  const encounterMap = new Map<string, EnemyEncounter>();
  for (const enc of encounters) {
    const key = `${enc.enemyName}:${enc.enemyTier}`;
    encounterMap.set(key, enc);
  }

  const entries: EnemyEntry[] = [];
  for (const tier of TIER_ORDER) {
    entries.push({ type: "header", tier });
    const pool = NAME_POOLS[tier];
    for (const name of pool) {
      const tierInt = TIER_ORDER.indexOf(tier);
      const key = `${name}:${tierInt}`;
      const enc = encounterMap.get(key);
      if (enc) {
        entries.push({
          type: "enemy",
          tier,
          name,
          encountered: true,
          timesDefeated: enc.timesDefeated,
          firstEncounter: enc.firstDefeatedAt,
        });
      } else {
        entries.push({
          type: "enemy",
          tier,
          name: "???",
          encountered: false,
        });
      }
    }
  }
  return entries;
}

function renderProgressBar(pct: number, width: number): string {
  const filled = Math.round(pct * width);
  const empty = width - filled;
  return "[" + "#".repeat(filled) + "-".repeat(empty) + "]";
}

export function BestiaryScreen({ encounters, collectionStats, onBack }: Props) {
  const theme = useGameTheme();
  const [activeTab, setActiveTab] = useState<TabKey>("enemies");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const enemyList = buildEnemyList(encounters);
  const enemySelectableIndices = enemyList.reduce<number[]>((acc, entry, i) => {
    if (entry.type === "enemy") acc.push(i);
    return acc;
  }, []);

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.tab) {
      setActiveTab((prev) => (prev === "enemies" ? "collection" : "enemies"));
      setSelectedIndex(0);
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      if (activeTab === "enemies") {
        setSelectedIndex((prev) =>
          Math.min(enemySelectableIndices.length - 1, prev + 1),
        );
      } else {
        setSelectedIndex((prev) =>
          Math.min(collectionStats.length - 1, prev + 1),
        );
      }
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box
        borderStyle="round"
        borderColor={theme.colors.rare}
        paddingX={1}
        marginBottom={1}
      >
        <Text bold color={theme.colors.rare}>
          Bestiary
        </Text>
      </Box>

      {/* Tabs */}
      <Box marginBottom={1} gap={2}>
        <Text
          bold={activeTab === "enemies"}
          color={activeTab === "enemies" ? theme.colors.gold : theme.colors.muted}
          underline={activeTab === "enemies"}
        >
          Enemies
        </Text>
        <Text
          bold={activeTab === "collection"}
          color={activeTab === "collection" ? theme.colors.gold : theme.colors.muted}
          underline={activeTab === "collection"}
        >
          Collection
        </Text>
      </Box>

      {/* Content */}
      <Box
        borderStyle="single"
        borderColor={theme.colors.muted}
        flexDirection="column"
        paddingX={1}
        marginBottom={1}
      >
        {activeTab === "enemies" ? (
          renderEnemiesTab(enemyList, enemySelectableIndices, selectedIndex, theme)
        ) : (
          renderCollectionTab(collectionStats, selectedIndex, theme)
        )}
      </Box>

      {/* Navigation hint */}
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>
          <Text bold>{"\u2191"}</Text>/<Text bold>{"\u2193"}</Text> scroll{"  "}
          <Text bold>Tab</Text> switch tab{"  "}
          <Text bold>Esc</Text> go back
        </Text>
      </Box>
    </Box>
  );
}

function renderEnemiesTab(
  enemyList: EnemyEntry[],
  selectableIndices: number[],
  selectedIndex: number,
  theme: ReturnType<typeof useGameTheme>,
) {
  const selectedListIndex =
    selectableIndices.length > 0 ? selectableIndices[selectedIndex] : -1;

  return enemyList.map((entry, i) => {
    if (entry.type === "header") {
      return (
        <Box key={`header-${entry.tier}`} marginTop={i === 0 ? 0 : 1}>
          <Text bold color={theme.colors.rare}>
            -- {TIER_LABELS[entry.tier]} --
          </Text>
        </Box>
      );
    }

    const isSelected = i === selectedListIndex;

    if (entry.encountered) {
      return (
        <Box key={`${entry.tier}-${entry.name}-${i}`} paddingLeft={1}>
          <Text color={theme.colors.success}>
            {isSelected ? "> " : "  "}
            {entry.name}
          </Text>
          <Text color={theme.colors.muted}>
            {" — "}x{entry.timesDefeated}
            {entry.firstEncounter
              ? ` (first: ${entry.firstEncounter.split("T")[0] ?? entry.firstEncounter.split(" ")[0]})`
              : ""}
          </Text>
        </Box>
      );
    }

    return (
      <Box key={`unknown-${entry.tier}-${i}`} paddingLeft={1}>
        <Text dimColor>
          {isSelected ? "> " : "  "}???
        </Text>
      </Box>
    );
  });
}

function renderCollectionTab(
  collectionStats: CollectionDeckStats[],
  selectedIndex: number,
  theme: ReturnType<typeof useGameTheme>,
) {
  if (collectionStats.length === 0) {
    return (
      <Text color={theme.colors.muted}>No decks imported yet</Text>
    );
  }

  return collectionStats.map((deck, i) => {
    const isSelected = i === selectedIndex;
    const pct = deck.total > 0 ? deck.mastered / deck.total : 0;
    const pctDisplay = Math.round(pct * 100);
    const bar = renderProgressBar(pct, 20);

    return (
      <Box key={deck.name} flexDirection="column" marginBottom={i < collectionStats.length - 1 ? 1 : 0}>
        <Text>
          <Text bold={isSelected} color={isSelected ? theme.colors.gold : undefined}>
            {isSelected ? "> " : "  "}{deck.name}
          </Text>
        </Text>
        <Box paddingLeft={4}>
          <Text color={theme.colors.muted}>
            {deck.total} cards, {deck.mastered} mastered
          </Text>
        </Box>
        <Box paddingLeft={4}>
          <Text color={pct >= 1 ? theme.colors.success : theme.colors.mana}>
            {bar} {pctDisplay}%
          </Text>
        </Box>
      </Box>
    );
  });
}
