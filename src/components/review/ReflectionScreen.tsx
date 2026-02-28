import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

interface ReflectionScreenProps {
  accuracy: number; // 0-1
  cardsReviewed: number;
  cpjMessages?: string[]; // growth mindset messages for low accuracy
  showJournal?: boolean; // default false
  reflectionPrompt?: string; // prompt to show for journal
  onComplete: (result: {
    difficultyRating: 1 | 2 | 3;
    journalEntry?: string;
    wisdomXp: number;
  }) => void;
}

type Phase = "micro-reflection" | "xp-awarded" | "journal" | "done";

export function ReflectionScreen({
  accuracy,
  cardsReviewed,
  cpjMessages,
  showJournal = false,
  reflectionPrompt,
  onComplete,
}: ReflectionScreenProps) {
  const [phase, setPhase] = useState<Phase>("micro-reflection");
  const [difficultyRating, setDifficultyRating] = useState<1 | 2 | 3 | null>(
    null,
  );
  const [journalText, setJournalText] = useState("");
  const [journalEntry, setJournalEntry] = useState<string | undefined>(
    undefined,
  );

  const accuracyPercent = Math.round(accuracy * 100);

  // Handle transition from xp-awarded to next phase
  useEffect(() => {
    if (phase === "xp-awarded") {
      const timer = setTimeout(() => {
        if (showJournal) {
          setPhase("journal");
        } else {
          setPhase("done");
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [phase, showJournal]);

  // Handle completion when phase reaches "done"
  useEffect(() => {
    if (phase === "done" && difficultyRating !== null) {
      onComplete({
        difficultyRating,
        journalEntry,
        wisdomXp: 25 + (journalEntry ? 50 : 0),
      });
    }
  }, [phase, difficultyRating, journalEntry, onComplete]);

  // Phase 1: Micro-reflection keystroke capture
  useInput(
    (_input) => {
      if (_input === "1" || _input === "2" || _input === "3") {
        const rating = Number(_input) as 1 | 2 | 3;
        setDifficultyRating(rating);
        setPhase("xp-awarded");
      }
    },
    { isActive: phase === "micro-reflection" },
  );

  // Phase 2: Journal Esc handler
  useInput(
    (_input, key) => {
      if (key.escape) {
        setPhase("done");
      }
    },
    { isActive: phase === "journal" },
  );

  const handleJournalSubmit = (value: string) => {
    if (value.trim().length > 0) {
      setJournalEntry(value.trim());
      setPhase("done");
    }
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Post-Battle Meditation
        </Text>
      </Box>

      {/* Session stats */}
      <Box marginBottom={1}>
        <Text>
          Accuracy: <Text bold>{accuracyPercent}%</Text> | Cards:{" "}
          <Text bold>{cardsReviewed}</Text>
        </Text>
      </Box>

      {/* CPJ Messages */}
      {cpjMessages && cpjMessages.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {cpjMessages.map((msg, i) =>
            i === 0 ? (
              <Text key={i} color="yellow">
                {msg}
              </Text>
            ) : (
              <Text key={i} dimColor>
                {msg}
              </Text>
            ),
          )}
        </Box>
      )}

      {/* Phase 1: Difficulty selection */}
      {phase === "micro-reflection" && (
        <Box flexDirection="column">
          <Text>[1] Crushing defeat (I was guessing)</Text>
          <Text>[2] Hard-fought (I had to think)</Text>
          <Text>[3] Effortless (too easy)</Text>
        </Box>
      )}

      {/* XP awarded feedback */}
      {phase === "xp-awarded" && (
        <Box marginTop={1}>
          <Text color="magenta">+25 Wisdom XP</Text>
        </Box>
      )}

      {/* Phase 2: Journal */}
      {phase === "journal" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>
            {reflectionPrompt ?? "What did you learn?"}
          </Text>
          <Box marginTop={1}>
            <TextInput
              value={journalText}
              onChange={setJournalText}
              onSubmit={handleJournalSubmit}
            />
          </Box>
          <Text dimColor>Press Esc to skip</Text>
        </Box>
      )}
    </Box>
  );
}
