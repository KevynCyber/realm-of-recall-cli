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

interface Props {
  card: Card;
  showAnswer: boolean;
  evolutionTier?: number;
  cardHealth?: "healthy" | "struggling" | "leech";
}

export function FlashcardFace({
  card,
  showAnswer,
  evolutionTier,
  cardHealth,
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

  // Health overrides
  if (cardHealth === "struggling") borderColor = "yellow";
  if (cardHealth === "leech") borderColor = "red";

  const headerLabel = showAnswer ? "Answer" : "Question";

  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle}
      borderColor={borderColor}
      paddingX={2}
      paddingY={1}
    >
      <Text bold color={borderColor}>
        {headerLabel}
        {stars ? ` ${stars}` : ""}
      </Text>
      <Text>{showAnswer ? card.back : frontText}</Text>
      {tier >= 3 && (
        <Text dimColor>MASTERED</Text>
      )}
      {cardHealth === "struggling" && (
        <Text color="yellow">{"\u26A0"} Struggling</Text>
      )}
      {cardHealth === "leech" && (
        <Text color="red">{"\u2716"} Leech {"\u2014"} needs deeper study</Text>
      )}
    </Box>
  );
}
