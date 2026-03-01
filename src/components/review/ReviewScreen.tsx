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
  elaborationText?: string;
}

interface Props {
  cards: Card[];
  onComplete: (results: ReviewResult[]) => void;
  mode?: RetrievalMode;
  timerSeconds?: number;
}

type Phase = "question" | "answer" | "feedback" | "confidence" | "teach_rate" | "elaboration";

/** Exported for testing — override in tests via dependency injection. */
export let _rollElaboration = (): boolean => Math.random() < 0.3;

const ELABORATION_PROMPTS = [
  (answer: string) => `Why is "${answer}" correct?`,
  () => "How does this connect to what you know?",
];

function pickElaborationPrompt(answer: string): string {
  const idx = Math.floor(Math.random() * ELABORATION_PROMPTS.length);
  return ELABORATION_PROMPTS[idx](answer);
}

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
  timerSeconds: timerSecondsProp = 30,
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

  // Successive relearning: mutable card queue and re-queue tracking
  const MAX_REQUEUES = 2;
  const [cardQueue, setCardQueue] = useState<Card[]>(() => [...cards]);
  const [requeueCounts, setRequeueCounts] = useState<Map<string, number>>(
    () => new Map(),
  );
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
  // Suspend/bury confirmation
  const [cardActionMsg, setCardActionMsg] = useState<string | null>(null);
  // Undo support: tracks whether the current card was reached via undo (prevent double undo)
  const [undoUsed, setUndoUsed] = useState(false);
  const [undoMsg, setUndoMsg] = useState<string | null>(null);
  // Elaboration prompt state
  const [elaborationPrompt, setElaborationPrompt] = useState<string>("");
  const [elaborationInput, setElaborationInput] = useState("");

  const card = cardQueue[currentIndex];
  const totalTime = timerSecondsProp === 0 ? Infinity : timerSecondsProp; // 0 = disabled
  const isTeach = mode === RetrievalMode.Teach;

  // Build the "effective" card used for display & evaluation.
  const effectiveCard: Card | undefined =
    card && mode === RetrievalMode.Reversed ? buildReversedCard(card) : card;

  // ------------------------------------------------------------------ handlers

  /**
   * Re-queue a failed card to the end of the queue for successive relearning.
   * Max 2 re-queues per card to avoid infinite loops.
   */
  const requeueCard = useCallback(
    (failedCard: Card) => {
      const count = requeueCounts.get(failedCard.id) ?? 0;
      if (count < MAX_REQUEUES) {
        setCardQueue((prev) => [...prev, failedCard]);
        setRequeueCounts((prev) => {
          const next = new Map(prev);
          next.set(failedCard.id, count + 1);
          return next;
        });
      }
    },
    [requeueCounts],
  );

  /**
   * Advance to next card or complete the review session.
   * `extras` lets callers attach optional fields (confidence, responseText, etc.)
   * that get merged into the *current* result that was already pushed.
   * `qualityOverride` allows callers to pass the quality directly (needed when
   * setLastQuality hasn't yet flushed, e.g. teach_rate phase).
   */
  const advanceCard = useCallback(
    (extras?: Partial<ReviewResult>, qualityOverride?: AnswerQuality) => {
      // Re-queue failed cards for successive relearning
      const quality = qualityOverride ?? lastQuality;
      if (
        card &&
        quality !== null &&
        (quality === AnswerQuality.Wrong ||
          quality === AnswerQuality.Timeout)
      ) {
        requeueCard(card);
      }

      setResults((prev) => {
        const updated = [...prev];
        if (extras && updated.length > 0) {
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            ...extras,
          };
        }
        if (currentIndex + 1 >= cardQueue.length) {
          // Use setTimeout so we don't call onComplete during render
          setTimeout(() => onComplete(updated), 0);
          return updated;
        }
        return updated;
      });
      if (currentIndex + 1 < cardQueue.length) {
        setCurrentIndex((i) => i + 1);
        setPhase("question");
        setInput("");
        setLastQuality(null);
        setCardStart(Date.now());
        setPendingResponseText(undefined);
        setHintLevel(0);
        setShowHint(false);
        setUndoUsed(false);
        setElaborationInput("");
        setElaborationPrompt("");
      }
    },
    [cardQueue.length, currentIndex, onComplete, card, lastQuality, requeueCard],
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
      if (_input === "u" || _input === "U") {
        if (!undoUsed && results.length > 0) {
          // Undo: remove last result, go back to question phase
          setResults((prev) => prev.slice(0, -1));
          setPhase("question");
          setInput("");
          setLastQuality(null);
          setCardStart(Date.now());
          setPendingResponseText(undefined);
          setHintLevel(0);
          setShowHint(false);
          setUndoUsed(true);
          setUndoMsg("Answer undone");
          setTimeout(() => setUndoMsg(null), 1500);
          return;
        }
      }
      if (key.return || _input === " ") {
        if (
          lastQuality !== null &&
          (lastQuality === AnswerQuality.Perfect ||
            lastQuality === AnswerQuality.Correct)
        ) {
          // Check for elaboration prompt: tier >= 1 and 30% chance
          const tier = card ? (cardTiers.get(card.id) ?? 0) : 0;
          if (tier >= 1 && _rollElaboration()) {
            const prompt = pickElaborationPrompt(effectiveCard?.back ?? "");
            setElaborationPrompt(prompt);
            setElaborationInput("");
            setPhase("elaboration");
          } else {
            setPhase("confidence");
          }
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
          // Wrong — skip confidence, advance (pass quality for re-queue check)
          advanceCard({ quality, responseText: pendingResponseText }, quality);
        }
      }
    },
    { isActive: phase === "teach_rate" },
  );

  // Elaboration phase — user submits explanation (or presses Enter to skip)
  const handleElaborationSubmit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed) {
        // Store elaboration text on the result
        setResults((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              responseText: trimmed,
              elaborationText: trimmed,
            };
          }
          return updated;
        });
      }
      setPhase("confidence");
    },
    [],
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

  // Suspend/Bury key handler — press S to suspend, B to bury during question phase
  const skipCurrentCard = useCallback(() => {
    if (currentIndex + 1 >= cardQueue.length) {
      setTimeout(() => onComplete(results), 0);
    } else {
      setCurrentIndex((i) => i + 1);
      setPhase("question");
      setInput("");
      setLastQuality(null);
      setCardStart(Date.now());
      setPendingResponseText(undefined);
      setHintLevel(0);
      setShowHint(false);
    }
  }, [cardQueue.length, currentIndex, onComplete, results]);

  useInput(
    (_input) => {
      if (!card) return;
      if (_input === "s" || _input === "S") {
        try {
          const db = getDatabase();
          const statsRepo = new StatsRepository(db);
          statsRepo.suspendCard(card.id);
          setCardActionMsg("Card suspended");
          setTimeout(() => {
            setCardActionMsg(null);
            skipCurrentCard();
          }, 800);
        } catch {
          // ignore
        }
      } else if (_input === "b" || _input === "B") {
        try {
          const db = getDatabase();
          const statsRepo = new StatsRepository(db);
          statsRepo.buryCard(card.id);
          setCardActionMsg("Card buried until tomorrow");
          setTimeout(() => {
            setCardActionMsg(null);
            skipCurrentCard();
          }, 800);
        } catch {
          // ignore
        }
      }
    },
    { isActive: phase === "question" && !cardActionMsg },
  );

  // --------------------------------------------------------------- guard
  if (!card || !effectiveCard) {
    onComplete(results);
    return null;
  }

  // --------------------------------------------------------------- render helpers

  const progress =
    (currentIndex +
      (phase === "feedback" || phase === "confidence" || phase === "teach_rate" || phase === "elaboration"
        ? 1
        : 0)) /
    cardQueue.length;

  /** Human-friendly mode label */
  const modeLabel =
    mode === RetrievalMode.Standard ? "Standard"
    : mode === RetrievalMode.Reversed ? "Reversed"
    : mode === RetrievalMode.Teach ? "Teach"
    : "Connect";

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text dimColor>
          Card {currentIndex + 1}/{cardQueue.length}{" "}
        </Text>
        <ProgressBar value={progress} width={30} />
        <Text dimColor>{"  "}Mode: </Text>
        <Text color="cyan">{modeLabel}</Text>
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
            phase === "confidence" ||
            phase === "elaboration"
          }
          evolutionTier={cardTiers.get(card.id) ?? 0}
          cardHealth={cardHealthMap.get(card.id) ?? "healthy"}
          isRetry={(requeueCounts.get(card.id) ?? 0) > 0 && currentIndex >= cards.length}
        />
      )}

      {/* Teach mode: question phase — prompt for explanation */}
      {isTeach && phase === "question" && !cardActionMsg && (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text bold>Explain this concept: </Text>
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleTeachSubmit}
            />
          </Box>
          <Text dimColor italic>Press [S] suspend | [B] bury</Text>
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

      {/* Suspend/Bury confirmation */}
      {cardActionMsg && (
        <Box marginTop={1}>
          <Text bold color="yellow">{cardActionMsg}</Text>
        </Box>
      )}

      {/* Standard/Reversed: question phase — text input */}
      {!isTeach && phase === "question" && !cardActionMsg && (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text bold>Your answer: </Text>
            <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
          </Box>
          {!showHint && (
            <Text dimColor italic>Press [H] for a hint | [S] suspend | [B] bury</Text>
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

      {/* Undo confirmation message */}
      {undoMsg && (
        <Box marginTop={1}>
          <Text bold color="yellow">{undoMsg}</Text>
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
            Press Enter to continue...{!undoUsed ? " [U] undo" : ""}
          </Text>
        </Box>
      )}

      {/* Elaboration prompt */}
      {phase === "elaboration" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="magenta">{elaborationPrompt}</Text>
          <Box>
            <Text bold>Your explanation: </Text>
            <TextInput
              value={elaborationInput}
              onChange={setElaborationInput}
              onSubmit={handleElaborationSubmit}
            />
          </Box>
          <Text dimColor italic>Type your explanation or press Enter to skip (+15 Wisdom XP)</Text>
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
