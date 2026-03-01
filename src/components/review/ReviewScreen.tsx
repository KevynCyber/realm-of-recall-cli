import React, { useState, useCallback, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { Card } from "../../types/index.js";
import {
  AnswerQuality,
  ConfidenceLevel,
  RetrievalMode,
} from "../../types/index.js";
import { evaluateAnswer } from "../../core/cards/CardEvaluator.js";
import { generateHint, getMaxHintLevel, isFullReveal } from "../../core/cards/HintGenerator.js";
import { FlashcardFace } from "./FlashcardFace.js";
import { ProgressBar } from "../common/ProgressBar.js";
import { getDatabase } from "../../data/database.js";
import { StatsRepository } from "../../data/repositories/StatsRepository.js";
import { getCardHealth } from "../../core/cards/CardEvolution.js";
import type { CardHealthStatus } from "../../core/cards/CardEvolution.js";

export interface ReviewResult {
  cardId: string;
  quality: AnswerQuality;
  responseTime: number;
  confidence?: ConfidenceLevel;
  retrievalMode?: RetrievalMode;
  responseText?: string;
}

interface Props {
  cards: Card[];
  onComplete: (results: ReviewResult[]) => void;
  mode?: RetrievalMode;
}

type Phase = "question" | "answer" | "feedback" | "confidence" | "teach_rate";

/**
 * Build a display card that swaps front/back for reversed mode and merges
 * the original front into acceptableAnswers so evaluateAnswer works.
 */
function buildReversedCard(card: Card): Card {
  const answers = new Set([
    card.front,
    ...card.acceptableAnswers,
  ]);
  return {
    ...card,
    front: card.back,
    back: card.front,
    acceptableAnswers: [...answers],
  };
}

export function ReviewScreen({
  cards,
  onComplete,
  mode = RetrievalMode.Standard,
}: Props) {
  // Look up evolution tiers for all cards
  const cardTiers = useMemo(() => {
    try {
      const db = getDatabase();
      const statsRepo = new StatsRepository(db);
      const tiers = new Map<string, number>();
      for (const c of cards) {
        tiers.set(c.id, statsRepo.getCardEvolutionTier(c.id));
      }
      return tiers;
    } catch {
      return new Map<string, number>();
    }
  }, [cards]);

  // Look up card health status for all cards
  const cardHealthMap = useMemo(() => {
    try {
      const db = getDatabase();
      const statsRepo = new StatsRepository(db);
      const healthMap = new Map<string, CardHealthStatus>();
      for (const c of cards) {
        const { recentQualities, totalLapses } = statsRepo.getCardHealthData(c.id);
        healthMap.set(c.id, getCardHealth(recentQualities, totalLapses));
      }
      return healthMap;
    } catch {
      return new Map<string, CardHealthStatus>();
    }
  }, [cards]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [input, setInput] = useState("");
  const [lastQuality, setLastQuality] = useState<AnswerQuality | null>(null);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [cardStart, setCardStart] = useState(Date.now());
  // Stores the user's typed explanation in Teach mode
  const [pendingResponseText, setPendingResponseText] = useState<
    string | undefined
  >(undefined);
  // Hint system
  const [hintLevel, setHintLevel] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const card = cards[currentIndex];
  const totalTime = 30; // seconds
  const isTeach = mode === RetrievalMode.Teach;

  // Build the "effective" card used for display & evaluation.
  const effectiveCard: Card | undefined =
    card && mode === RetrievalMode.Reversed ? buildReversedCard(card) : card;

  // ------------------------------------------------------------------ handlers

  /**
   * Advance to next card or complete the review session.
   * `extras` lets callers attach optional fields (confidence, responseText, etc.)
   * that get merged into the *current* result that was already pushed.
   */
  const advanceCard = useCallback(
    (extras?: Partial<ReviewResult>) => {
      setResults((prev) => {
        const updated = [...prev];
        if (extras && updated.length > 0) {
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            ...extras,
          };
        }
        if (currentIndex + 1 >= cards.length) {
          // Use setTimeout so we don't call onComplete during render
          setTimeout(() => onComplete(updated), 0);
          return updated;
        }
        return updated;
      });
      if (currentIndex + 1 < cards.length) {
        setCurrentIndex((i) => i + 1);
        setPhase("question");
        setInput("");
        setLastQuality(null);
        setCardStart(Date.now());
        setPendingResponseText(undefined);
        setHintLevel(0);
        setShowHint(false);
      }
    },
    [cards.length, currentIndex, onComplete],
  );

  // Standard / Reversed answer submission
  const handleSubmit = useCallback(
    (answer: string) => {
      if (!effectiveCard) return;
      const responseTime = (Date.now() - cardStart) / 1000;
      const quality = evaluateAnswer(
        effectiveCard,
        answer,
        responseTime,
        totalTime,
      );
      setLastQuality(quality);
      setResults((prev) => [
        ...prev,
        {
          cardId: card.id,
          quality,
          responseTime,
          retrievalMode: mode,
        },
      ]);
      setPhase("feedback");
    },
    [effectiveCard, card, cardStart, totalTime, mode],
  );

  // Teach mode: user submits their explanation
  const handleTeachSubmit = useCallback(
    (answer: string) => {
      if (!card) return;
      const responseTime = (Date.now() - cardStart) / 1000;
      setPendingResponseText(answer);
      // Don't evaluate automatically — user will self-rate
      setResults((prev) => [
        ...prev,
        {
          cardId: card.id,
          quality: AnswerQuality.Correct, // placeholder, overwritten in teach_rate
          responseTime,
          retrievalMode: mode,
          responseText: answer,
        },
      ]);
      setPhase("teach_rate");
    },
    [card, cardStart, mode],
  );

  // ----------------------------------------------------------------- useInput hooks

  // Feedback phase — press Enter to continue (only for wrong/timeout/partial in standard modes)
  useInput(
    (_input, key) => {
      if (key.return || _input === " ") {
        if (
          lastQuality !== null &&
          (lastQuality === AnswerQuality.Perfect ||
            lastQuality === AnswerQuality.Correct)
        ) {
          // Transition to confidence phase instead of advancing
          setPhase("confidence");
        } else {
          advanceCard();
        }
      }
    },
    { isActive: phase === "feedback" },
  );

  // Confidence phase — single keystroke 1/2/3
  useInput(
    (_input) => {
      let confidence: ConfidenceLevel | undefined;
      if (_input === "1") confidence = ConfidenceLevel.Guess;
      else if (_input === "2") confidence = ConfidenceLevel.Knew;
      else if (_input === "3") confidence = ConfidenceLevel.Instant;

      if (confidence !== undefined) {
        advanceCard({ confidence });
      }
    },
    { isActive: phase === "confidence" },
  );

  // Teach rate phase — single keystroke 1/2/3/4
  useInput(
    (_input) => {
      let quality: AnswerQuality | undefined;
      if (_input === "1") quality = AnswerQuality.Perfect;
      else if (_input === "2") quality = AnswerQuality.Correct;
      else if (_input === "3") quality = AnswerQuality.Partial;
      else if (_input === "4") quality = AnswerQuality.Wrong;

      if (quality !== undefined) {
        setLastQuality(quality);

        // Update the last result's quality and responseText
        setResults((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              quality,
              responseText: pendingResponseText,
            };
          }
          return updated;
        });

        // Ratings 1-3 are "correct" — go to confidence
        if (quality !== AnswerQuality.Wrong) {
          setPhase("confidence");
        } else {
          // Wrong — skip confidence, advance
          advanceCard({ quality, responseText: pendingResponseText });
        }
      }
    },
    { isActive: phase === "teach_rate" },
  );

  // Hint key handler — press H during question phase to reveal progressive hints
  useInput(
    (_input) => {
      if (_input === "h" || _input === "H") {
        if (!showHint) {
          setShowHint(true);
        } else if (!isFullReveal(hintLevel + 1)) {
          setHintLevel((l) => Math.min(l + 1, getMaxHintLevel()));
        }
      }
    },
    { isActive: phase === "question" && !isTeach },
  );

  // --------------------------------------------------------------- guard
  if (!card || !effectiveCard) {
    onComplete(results);
    return null;
  }

  // --------------------------------------------------------------- render helpers

  const progress =
    (currentIndex +
      (phase === "feedback" || phase === "confidence" || phase === "teach_rate"
        ? 1
        : 0)) /
    cards.length;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text dimColor>
          Card {currentIndex + 1}/{cards.length}{" "}
        </Text>
        <ProgressBar value={progress} width={30} />
      </Box>

      {/* Question / Answer display */}
      {isTeach ? (
        <TeachDisplay
          card={card}
          phase={phase}
        />
      ) : (
        <FlashcardFace
          card={effectiveCard}
          showAnswer={
            phase === "feedback" ||
            phase === "confidence"
          }
          evolutionTier={cardTiers.get(card.id) ?? 0}
          cardHealth={cardHealthMap.get(card.id) ?? "healthy"}
        />
      )}

      {/* Teach mode: question phase — prompt for explanation */}
      {isTeach && phase === "question" && (
        <Box marginTop={1}>
          <Text bold>Explain this concept: </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleTeachSubmit}
          />
        </Box>
      )}

      {/* Hint display */}
      {!isTeach && phase === "question" && showHint && effectiveCard && (
        <Box marginTop={1}>
          <Text color="cyan">
            Hint: {generateHint(effectiveCard.back, hintLevel)}
          </Text>
          {!isFullReveal(hintLevel + 1) ? (
            <Text dimColor>  [H] more</Text>
          ) : null}
        </Box>
      )}

      {/* Standard/Reversed: question phase — text input */}
      {!isTeach && phase === "question" && (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text bold>Your answer: </Text>
            <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
          </Box>
          {!showHint && (
            <Text dimColor italic>Press [H] for a hint</Text>
          )}
        </Box>
      )}

      {/* Teach rate phase — self rating */}
      {phase === "teach_rate" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Rate your explanation:</Text>
          <Text>
            <Text color="yellow">[1]</Text> Nailed it{"  "}
            <Text color="green">[2]</Text> Decent{"  "}
            <Text color="cyan">[3]</Text> Weak{"  "}
            <Text color="red">[4]</Text> Wrong
          </Text>
        </Box>
      )}

      {/* Feedback display (standard / reversed modes) */}
      {phase === "feedback" && lastQuality !== null && (
        <Box flexDirection="column" marginTop={1}>
          <FeedbackLine quality={lastQuality} />
          <Text dimColor>
            Correct answer:{" "}
            <Text color="green">{effectiveCard.back}</Text>
          </Text>
          <Text dimColor italic>
            Press Enter to continue...
          </Text>
        </Box>
      )}

      {/* Confidence prompt */}
      {phase === "confidence" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>How confident were you?</Text>
          <Text>
            <Text color="yellow">[1]</Text> Lucky guess{"  "}
            <Text color="green">[2]</Text> Knew it{"  "}
            <Text color="cyan">[3]</Text> Instant recall
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------- sub-components

/** Teach mode display: shows front as question, and after submission shows back as reference. */
function TeachDisplay({ card, phase }: { card: Card; phase: Phase }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="cyan">
        {phase === "question" ? "Concept" : "Reference Answer"}
      </Text>
      {phase === "question" ? (
        <Text>{card.front}</Text>
      ) : (
        <Box flexDirection="column">
          <Text>{card.front}</Text>
          <Text dimColor>---</Text>
          <Text color="green">{card.back}</Text>
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
