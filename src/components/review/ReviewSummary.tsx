import React from "react";
import { Box, Text } from "ink";
import { AnswerQuality } from "../../types/index.js";
import { LEVEL_UP_ART } from "../../core/ui/TerminalEffects.js";

interface ReviewResult {
  cardId: string;
  quality: AnswerQuality;
  responseTime: number;
}

export interface RetentionBonusCard {
  cardId: string;
  multiplier: number;
}

interface Props {
  results: ReviewResult[];
  xpEarned?: number;
  goldEarned?: number;
  leveledUp?: boolean;
  newLevel?: number;
  retentionBonusCards?: RetentionBonusCard[];
}

export function ReviewSummary({ results, xpEarned, goldEarned, leveledUp, newLevel, retentionBonusCards }: Props) {
  const total = results.length;
  const perfect = results.filter(
    (r) => r.quality === AnswerQuality.Perfect,
  ).length;
  const correct = results.filter(
    (r) => r.quality === AnswerQuality.Correct,
  ).length;
  const partial = results.filter(
    (r) => r.quality === AnswerQuality.Partial,
  ).length;
  const wrong = results.filter(
    (r) =>
      r.quality === AnswerQuality.Wrong || r.quality === AnswerQuality.Timeout,
  ).length;
  const accuracy = total > 0 ? ((perfect + correct + partial) / total) * 100 : 0;
  const avgTime =
    total > 0
      ? results.reduce((sum, r) => sum + r.responseTime, 0) / total
      : 0;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="green">
        Review Complete!
      </Text>
      <Text> </Text>
      <Text>
        Cards reviewed: <Text bold>{total}</Text>
      </Text>
      <Text>
        <Text color="yellow">Perfect: {perfect}</Text>
        {"  "}
        <Text color="green">Correct: {correct}</Text>
        {"  "}
        <Text color="cyan">Partial: {partial}</Text>
        {"  "}
        <Text color="red">Wrong: {wrong}</Text>
      </Text>
      <Text>
        Accuracy: <Text bold>{accuracy.toFixed(0)}%</Text>
      </Text>
      <Text>
        Avg time: <Text bold>{avgTime.toFixed(1)}s</Text>
      </Text>
      {xpEarned !== undefined && (
        <Text color="magenta">XP earned: +{xpEarned}</Text>
      )}
      {goldEarned !== undefined && (
        <Text color="yellow">Gold: +{goldEarned}</Text>
      )}
      {retentionBonusCards && retentionBonusCards.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">
            Long-term Recall Bonus!
          </Text>
          {retentionBonusCards.map((b) => (
            <Text key={b.cardId} color="cyan">
              {`  Card ${b.cardId.slice(0, 8)}... (${b.multiplier}x)`}
            </Text>
          ))}
        </Box>
      )}
      {leveledUp && newLevel !== undefined && (
        <Box flexDirection="column" marginTop={1}>
          {LEVEL_UP_ART.map((line, i) => (
            <Text key={i} bold color="yellow">{line}</Text>
          ))}
          <Text bold color="yellow">You are now level {newLevel}!</Text>
        </Box>
      )}
    </Box>
  );
}
