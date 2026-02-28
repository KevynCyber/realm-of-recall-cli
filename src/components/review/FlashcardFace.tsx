import React from "react";
import { Box, Text } from "ink";
import type { Card } from "../../types/index.js";
import { CardType } from "../../types/index.js";
import { parseCloze } from "../../core/cards/ClozeParser.js";

interface Props {
  card: Card;
  showAnswer: boolean;
}

export function FlashcardFace({ card, showAnswer }: Props) {
  const isCloze = card.type === CardType.ClozeDeletion;
  const frontText = isCloze ? parseCloze(card.front).displayText : card.front;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="cyan">
        {showAnswer ? "Answer" : "Question"}
      </Text>
      <Text>{showAnswer ? card.back : frontText}</Text>
    </Box>
  );
}
