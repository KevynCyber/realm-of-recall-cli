import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useGameTheme } from "../app/ThemeProvider.js";
import type { Deck } from "../../types/index.js";

type Phase =
  | "select_deck"
  | "new_deck_name"
  | "input_front"
  | "input_back"
  | "input_answers"
  | "saved";

interface Props {
  decks: Deck[];
  onCreateCard: (card: {
    front: string;
    back: string;
    acceptableAnswers: string[];
    deckId: string;
    isCloze: boolean;
  }) => void;
  onCreateDeck: (name: string) => string; // returns new deck ID
  onBack: () => void;
}

const CLOZE_PATTERN = /\{\{c\d+::([^:}]+)(?:::([^}]*))?\}\}/;

function detectCloze(text: string): boolean {
  return CLOZE_PATTERN.test(text);
}

export function CardCreatorScreen({
  decks,
  onCreateCard,
  onCreateDeck,
  onBack,
}: Props) {
  const theme = useGameTheme();
  const [phase, setPhase] = useState<Phase>("select_deck");
  const [selectedDeckIndex, setSelectedDeckIndex] = useState(0);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [newDeckName, setNewDeckName] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [answers, setAnswers] = useState("");
  const [cardsCreated, setCardsCreated] = useState(0);

  // Deck list includes an extra "+ New Deck" option at the end
  const deckOptions = [...decks, null]; // null = new deck option

  useInput((input, key) => {
    if (phase === "select_deck") {
      if (key.upArrow) {
        setSelectedDeckIndex((i) =>
          i > 0 ? i - 1 : deckOptions.length - 1,
        );
      } else if (key.downArrow) {
        setSelectedDeckIndex((i) =>
          i < deckOptions.length - 1 ? i + 1 : 0,
        );
      } else if (key.return) {
        const selected = deckOptions[selectedDeckIndex];
        if (selected === null) {
          // Create new deck
          setPhase("new_deck_name");
        } else {
          setSelectedDeckId(selected.id);
          setPhase("input_front");
        }
      } else if (key.escape) {
        onBack();
      }
    } else if (phase === "saved") {
      if (input === "a" || input === "A") {
        // Add another
        setFront("");
        setBack("");
        setAnswers("");
        setPhase("input_front");
      } else if (input === "d" || input === "D" || key.escape) {
        onBack();
      }
    }
  });

  const handleNewDeckSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const deckId = onCreateDeck(trimmed);
    setSelectedDeckId(deckId);
    setNewDeckName("");
    setPhase("input_front");
  };

  const handleFrontSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setFront(trimmed);

    // If cloze, skip back input - front IS the content
    if (detectCloze(trimmed)) {
      setPhase("input_answers");
    } else {
      setPhase("input_back");
    }
  };

  const handleBackSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setBack(trimmed);
    setPhase("input_answers");
  };

  const handleAnswersSubmit = (value: string) => {
    const isCloze = detectCloze(front);
    let acceptableAnswers: string[];

    if (isCloze) {
      // For cloze cards, extract answers from the cloze syntax
      const matches = front.matchAll(/\{\{c\d+::([^:}]+)(?:::([^}]*))?\}\}/g);
      acceptableAnswers = [...matches].map((m) => m[1]);
    } else {
      // For basic cards, the back is the primary answer
      // Additional acceptable answers are comma-separated
      const trimmed = value.trim();
      if (trimmed) {
        acceptableAnswers = [back, ...trimmed.split(",").map((a) => a.trim()).filter(Boolean)];
      } else {
        acceptableAnswers = [back];
      }
    }

    onCreateCard({
      front,
      back: isCloze ? front : back,
      acceptableAnswers,
      deckId: selectedDeckId,
      isCloze,
    });

    setCardsCreated((c) => c + 1);
    setPhase("saved");
  };

  const selectedDeckName =
    decks.find((d) => d.id === selectedDeckId)?.name ?? "New Deck";

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" flexDirection="column" paddingX={1}>
        <Text bold>Create Cards</Text>
        {selectedDeckId && (
          <Text color={theme.colors.muted}>
            Deck: {selectedDeckName} | Cards created this session: {cardsCreated}
          </Text>
        )}
      </Box>

      {/* Phase: Select Deck */}
      {phase === "select_deck" && (
        <Box flexDirection="column" marginTop={1} paddingX={1}>
          <Text bold>Select a deck:</Text>
          <Box marginTop={1} flexDirection="column">
            {deckOptions.map((deck, i) => {
              const isSelected = i === selectedDeckIndex;
              if (deck === null) {
                return (
                  <Text key="__new__">
                    <Text bold={isSelected} color={theme.colors.success}>
                      {isSelected ? "> " : "  "}+ New Deck
                    </Text>
                  </Text>
                );
              }
              return (
                <Text key={deck.id}>
                  <Text bold={isSelected}>
                    {isSelected ? "> " : "  "}{deck.name}
                  </Text>
                </Text>
              );
            })}
          </Box>
          <Box marginTop={1}>
            <Text dimColor italic>
              Arrow keys to select | Enter to confirm | Esc to go back
            </Text>
          </Box>
        </Box>
      )}

      {/* Phase: New Deck Name */}
      {phase === "new_deck_name" && (
        <Box flexDirection="column" marginTop={1} paddingX={1}>
          <Text bold>Enter new deck name:</Text>
          <Box marginTop={1}>
            <Text bold color={theme.colors.gold}>
              {"> "}
            </Text>
            <TextInput
              value={newDeckName}
              onChange={setNewDeckName}
              onSubmit={handleNewDeckSubmit}
            />
          </Box>
        </Box>
      )}

      {/* Phase: Input Front */}
      {phase === "input_front" && (
        <Box flexDirection="column" marginTop={1} paddingX={1}>
          <Text bold>Card front (question):</Text>
          <Text color={theme.colors.muted}>
            Tip: Use {"{{c1::answer}}"} syntax for cloze deletions
          </Text>
          <Box marginTop={1}>
            <Text bold color={theme.colors.gold}>
              {"> "}
            </Text>
            <TextInput
              value={front}
              onChange={setFront}
              onSubmit={handleFrontSubmit}
            />
          </Box>
        </Box>
      )}

      {/* Phase: Input Back */}
      {phase === "input_back" && (
        <Box flexDirection="column" marginTop={1} paddingX={1}>
          <Text bold>Card back (answer):</Text>
          <Box marginTop={1}>
            <Text bold color={theme.colors.gold}>
              {"> "}
            </Text>
            <TextInput
              value={back}
              onChange={setBack}
              onSubmit={handleBackSubmit}
            />
          </Box>
        </Box>
      )}

      {/* Phase: Input Acceptable Answers */}
      {phase === "input_answers" && (
        <Box flexDirection="column" marginTop={1} paddingX={1}>
          {detectCloze(front) ? (
            <Text color={theme.colors.success}>
              Cloze card detected! Answers extracted automatically.
            </Text>
          ) : (
            <>
              <Text bold>Additional acceptable answers (optional):</Text>
              <Text color={theme.colors.muted}>
                Comma-separated, or press Enter to skip
              </Text>
            </>
          )}
          <Box marginTop={1}>
            <Text bold color={theme.colors.gold}>
              {"> "}
            </Text>
            <TextInput
              value={answers}
              onChange={setAnswers}
              onSubmit={handleAnswersSubmit}
            />
          </Box>
        </Box>
      )}

      {/* Phase: Saved */}
      {phase === "saved" && (
        <Box flexDirection="column" marginTop={1} paddingX={1}>
          <Text color={theme.colors.success} bold>
            Card saved! ({cardsCreated} card{cardsCreated !== 1 ? "s" : ""} created this session)
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text>
              <Text bold>[A]</Text> Add Another
            </Text>
            <Text>
              <Text bold>[D]</Text> Done
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
