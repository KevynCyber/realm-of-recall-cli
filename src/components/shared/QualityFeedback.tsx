import React from "react";
import { Text } from "ink";
import { AnswerQuality } from "../../types/index.js";

const config: Record<AnswerQuality, { text: string; color: string }> = {
  [AnswerQuality.Perfect]: { text: "PERFECT!", color: "yellow" },
  [AnswerQuality.Correct]: { text: "Correct!", color: "green" },
  [AnswerQuality.Partial]: { text: "Partial match", color: "cyan" },
  [AnswerQuality.Wrong]: { text: "Wrong!", color: "red" },
  [AnswerQuality.Timeout]: { text: "Time's up!", color: "red" },
};

export function QualityFeedback({ quality }: { quality: AnswerQuality }) {
  const { text, color } = config[quality];
  return (
    <Text bold color={color}>
      {text}
    </Text>
  );
}
