import { AnswerQuality, type Card } from "../../types/index.js";

const INSTANT_THRESHOLD = 1.0; // seconds — answer under 1s = Perfect

export function evaluateAnswer(
  card: Card,
  playerAnswer: string,
  responseTime: number,
  totalTime: number,
): AnswerQuality {
  if (responseTime >= totalTime) return AnswerQuality.Timeout;

  const trimmed = (playerAnswer ?? "").trim();
  if (trimmed.length === 0) return AnswerQuality.Timeout;

  // Exact match (case-insensitive)
  for (const acceptable of card.acceptableAnswers) {
    if (trimmed.toLowerCase() === acceptable.toLowerCase()) {
      return responseTime < INSTANT_THRESHOLD
        ? AnswerQuality.Perfect
        : AnswerQuality.Correct;
    }
  }

  // Partial match (substring in either direction)
  for (const acceptable of card.acceptableAnswers) {
    if (
      acceptable.toLowerCase().includes(trimmed.toLowerCase()) ||
      trimmed.toLowerCase().includes(acceptable.toLowerCase())
    ) {
      return AnswerQuality.Partial;
    }
  }

  return AnswerQuality.Wrong;
}
