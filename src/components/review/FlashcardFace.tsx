import React from "react";
import { Box, Text } from "ink";
import type { Card } from "../../types/index.js";
import { CardType } from "../../types/index.js";
import { parseCloze } from "../../core/cards/ClozeParser.js";

type BorderStyleName =
  | "single"
  | "double"
  | "round"
  | "bold"
  | "singleDouble"
  | "doubleSingle"
  | "classic"
  | "arrow";

const TIER_NAMES = ["New", "Learned", "Proven", "Mastered"];

interface Props {
  card: Card;
  showAnswer: boolean;
  evolutionTier?: number;
  cardHealth?: "healthy" | "struggling" | "leech";
  consecutiveCorrect?: number;
}

export function FlashcardFace({
  card,
  showAnswer,
  evolutionTier,
  cardHealth,
  consecutiveCorrect,
}: Props) {
  const isCloze = card.type === CardType.ClozeDeletion;
  const frontText = isCloze ? parseCloze(card.front).displayText : card.front;

  // Determine tier visuals
  const tier = evolutionTier ?? 0;
  let borderStyle: BorderStyleName = "round";
  let borderColor: string = "cyan";
  let stars = "";

  if (tier >= 2) {
    borderStyle = "double";
    borderColor = tier >= 3 ? "magenta" : "yellow";
  }
  if (tier >= 1) stars = "\u2605".repeat(tier);

  // Health color overrides
  const healthColor =
    cardHealth === "leech" ? "red" :
    cardHealth === "struggling" ? "yellow" :
    tier >= 3 ? "magenta" :
    tier >= 2 ? "yellow" :
    tier >= 1 ? "green" :
    undefined;

  if (cardHealth === "struggling") borderColor = "yellow";
  if (cardHealth === "leech") borderColor = "red";

  const headerLabel = showAnswer ? "Answer" : "Question";
  const tierName = TIER_NAMES[Math.min(tier, 3)];

  // Evolution progress bar (simple ASCII)
  const progressThresholds = [0, 3, 7, 12]; // correct answers per tier
  const currentThreshold = progressThresholds[Math.min(tier, 3)] ?? 12;
  const nextThreshold = progressThresholds[Math.min(tier + 1, 3)] ?? 12;
  const cc = consecutiveCorrect ?? 0;
  const progressInTier = tier >= 3 ? 1 : Math.min(1, cc / Math.max(1, nextThreshold));

  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle}
      borderColor={borderColor}
      paddingX={2}
      paddingY={1}
    >
      <Box>
        <Text bold color={borderColor}>
          {headerLabel}
          {stars ? ` ${stars}` : ""}
        </Text>
        {tier > 0 && (
          <Text dimColor> [{tierName}]</Text>
        )}
      </Box>
      <Text>{showAnswer ? card.back : frontText}</Text>

      {/* Evolution progress */}
      {tier < 3 && tier > 0 && (
        <Box marginTop={1}>
          <Text dimColor>Evolution: </Text>
          <Text color={healthColor}>
            {renderMiniBar(progressInTier, 10)}
          </Text>
          <Text dimColor> {tierName} {"\u2192"} {TIER_NAMES[Math.min(tier + 1, 3)]}</Text>
        </Box>
      )}

      {tier >= 3 && (
        <Text color="magenta" bold>MASTERED</Text>
      )}
      {cardHealth === "struggling" && (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">{"\u26A0"} Struggling</Text>
          <Text color="yellow" dimColor>This card needs more practice. Try explaining it in your own words.</Text>
        </Box>
      )}
      {cardHealth === "leech" && (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">{"\u2716"} Leech Card</Text>
          <Text color="red" dimColor>This card keeps tripping you up. Break it into simpler parts or try a mnemonic.</Text>
        </Box>
      )}
    </Box>
  );
}

function renderMiniBar(pct: number, width: number): string {
  const filled = Math.round(pct * width);
  const empty = width - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}
