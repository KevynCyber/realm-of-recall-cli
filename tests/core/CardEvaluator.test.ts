import { describe, it, expect } from "vitest";
import { evaluateAnswer } from "../../src/core/cards/CardEvaluator.js";
import { AnswerQuality, CardType, type Card } from "../../src/types/index.js";

function makeCard(back: string, acceptableAnswers?: string[]): Card {
  return {
    id: "test",
    front: "Q",
    back,
    acceptableAnswers: acceptableAnswers ?? [back],
    type: CardType.Basic,
    deckId: "deck1",
  };
}

describe("CardEvaluator", () => {
  it("returns Timeout when time runs out", () => {
    const card = makeCard("Paris");
    expect(evaluateAnswer(card, "Paris", 30, 30)).toBe(AnswerQuality.Timeout);
    expect(evaluateAnswer(card, "Paris", 31, 30)).toBe(AnswerQuality.Timeout);
  });

  it("returns Timeout for empty answer", () => {
    const card = makeCard("Paris");
    expect(evaluateAnswer(card, "", 5, 30)).toBe(AnswerQuality.Timeout);
    expect(evaluateAnswer(card, "   ", 5, 30)).toBe(AnswerQuality.Timeout);
  });

  it("returns Perfect for fast exact match", () => {
    const card = makeCard("Paris");
    expect(evaluateAnswer(card, "Paris", 0.5, 30)).toBe(AnswerQuality.Perfect);
  });

  it("returns Correct for slower exact match", () => {
    const card = makeCard("Paris");
    expect(evaluateAnswer(card, "Paris", 3, 30)).toBe(AnswerQuality.Correct);
  });

  it("is case-insensitive", () => {
    const card = makeCard("Paris");
    expect(evaluateAnswer(card, "paris", 3, 30)).toBe(AnswerQuality.Correct);
    expect(evaluateAnswer(card, "PARIS", 3, 30)).toBe(AnswerQuality.Correct);
  });

  it("checks all acceptable answers", () => {
    const card = makeCard("Brasília", ["Brasilia", "Brasília"]);
    expect(evaluateAnswer(card, "Brasilia", 3, 30)).toBe(AnswerQuality.Correct);
    expect(evaluateAnswer(card, "Brasília", 3, 30)).toBe(AnswerQuality.Correct);
  });

  it("returns Partial for substring match", () => {
    const card = makeCard("New Delhi");
    expect(evaluateAnswer(card, "Delhi", 3, 30)).toBe(AnswerQuality.Partial);
  });

  it("returns Partial when answer contains acceptable", () => {
    const card = makeCard("Paris");
    expect(evaluateAnswer(card, "Paris, France", 3, 30)).toBe(AnswerQuality.Partial);
  });

  it("returns Wrong for no match", () => {
    const card = makeCard("Paris");
    expect(evaluateAnswer(card, "London", 3, 30)).toBe(AnswerQuality.Wrong);
  });

  it("handles null answer", () => {
    const card = makeCard("Paris");
    expect(evaluateAnswer(card, null as any, 3, 30)).toBe(AnswerQuality.Timeout);
  });
});
