import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { Card } from "../../types/index.js";
import { AnswerQuality } from "../../types/index.js";
import { evaluateAnswer } from "../../core/cards/CardEvaluator.js";
import { FlashcardFace } from "./FlashcardFace.js";
import { ProgressBar } from "../common/ProgressBar.js";

interface ReviewResult {
  cardId: string;
  quality: AnswerQuality;
  responseTime: number;
}

interface Props {
  cards: Card[];
  onComplete: (results: ReviewResult[]) => void;
}

type Phase = "question" | "answer" | "feedback";

export function ReviewScreen({ cards, onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [input, setInput] = useState("");
  const [lastQuality, setLastQuality] = useState<AnswerQuality | null>(null);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [startTime] = useState(Date.now());
  const [cardStart, setCardStart] = useState(Date.now());

  const card = cards[currentIndex];
  const totalTime = 30; // seconds

  const handleSubmit = useCallback(
    (answer: string) => {
      const responseTime = (Date.now() - cardStart) / 1000;
      const quality = evaluateAnswer(card, answer, responseTime, totalTime);
      setLastQuality(quality);
      setResults((prev) => [
        ...prev,
        { cardId: card.id, quality, responseTime },
      ]);
      setPhase("feedback");
    },
    [card, cardStart, totalTime],
  );

  useInput(
    (_input, key) => {
      if (phase === "feedback" && (key.return || _input === " ")) {
        if (currentIndex + 1 >= cards.length) {
          onComplete([
            ...results,
          ]);
        } else {
          setCurrentIndex((i) => i + 1);
          setPhase("question");
          setInput("");
          setLastQuality(null);
          setCardStart(Date.now());
        }
      }
    },
    { isActive: phase === "feedback" },
  );

  if (!card) {
    onComplete(results);
    return null;
  }

  const progress = (currentIndex + (phase === "feedback" ? 1 : 0)) / cards.length;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text dimColor>
          Card {currentIndex + 1}/{cards.length}{" "}
        </Text>
        <ProgressBar value={progress} width={30} />
      </Box>

      <FlashcardFace card={card} showAnswer={phase === "feedback"} />

      {phase === "question" && (
        <Box marginTop={1}>
          <Text bold>Your answer: </Text>
          <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
        </Box>
      )}

      {phase === "feedback" && lastQuality !== null && (
        <Box flexDirection="column" marginTop={1}>
          <FeedbackLine quality={lastQuality} />
          <Text dimColor>
            Correct answer: <Text color="green">{card.back}</Text>
          </Text>
          <Text dimColor italic>
            Press Enter to continue...
          </Text>
        </Box>
      )}
    </Box>
  );
}

function FeedbackLine({ quality }: { quality: AnswerQuality }) {
  const config: Record<AnswerQuality, { text: string; color: string }> = {
    [AnswerQuality.Perfect]: { text: "PERFECT!", color: "yellow" },
    [AnswerQuality.Correct]: { text: "Correct!", color: "green" },
    [AnswerQuality.Partial]: { text: "Partial match", color: "cyan" },
    [AnswerQuality.Wrong]: { text: "Wrong", color: "red" },
    [AnswerQuality.Timeout]: { text: "Time's up!", color: "red" },
  };

  const { text, color } = config[quality];
  return (
    <Text bold color={color}>
      {text}
    </Text>
  );
}
