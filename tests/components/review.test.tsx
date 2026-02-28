import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { FlashcardFace } from "../../src/components/review/FlashcardFace.js";
import { ReviewSummary } from "../../src/components/review/ReviewSummary.js";
import { CardType, AnswerQuality } from "../../src/types/index.js";
import type { Card } from "../../src/types/index.js";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    front: "What is the capital of France?",
    back: "Paris",
    acceptableAnswers: ["Paris"],
    type: CardType.Basic,
    deckId: "deck-1",
    ...overrides,
  };
}

describe("FlashcardFace", () => {
  it("renders the question when showAnswer is false", () => {
    const card = makeCard();
    const { lastFrame } = render(<FlashcardFace card={card} showAnswer={false} />);
    const frame = lastFrame();
    expect(frame).toContain("Question");
    expect(frame).toContain("What is the capital of France?");
  });

  it("renders the answer when showAnswer is true", () => {
    const card = makeCard();
    const { lastFrame } = render(<FlashcardFace card={card} showAnswer={true} />);
    const frame = lastFrame();
    expect(frame).toContain("Answer");
    expect(frame).toContain("Paris");
  });

  it("renders cloze deletion front text with hint", () => {
    const card = makeCard({
      front: "The capital of France is {{c1::Paris::city}}",
      type: CardType.ClozeDeletion,
    });
    const { lastFrame } = render(<FlashcardFace card={card} showAnswer={false} />);
    const frame = lastFrame();
    expect(frame).toContain("Question");
    // The cloze parser should replace the cloze with hint text
    expect(frame).toContain("[city]");
    expect(frame).not.toContain("{{c1");
  });

  it("renders cloze card answer when showAnswer is true", () => {
    const card = makeCard({
      front: "{{c1::Paris::city}}",
      back: "Paris",
      type: CardType.ClozeDeletion,
    });
    const { lastFrame } = render(<FlashcardFace card={card} showAnswer={true} />);
    expect(lastFrame()).toContain("Paris");
  });
});

describe("ReviewSummary", () => {
  it("renders review complete header", () => {
    const { lastFrame } = render(<ReviewSummary results={[]} />);
    expect(lastFrame()).toContain("Review Complete!");
  });

  it("renders card count", () => {
    const results = [
      { cardId: "1", quality: AnswerQuality.Perfect, responseTime: 2 },
      { cardId: "2", quality: AnswerQuality.Correct, responseTime: 3 },
      { cardId: "3", quality: AnswerQuality.Wrong, responseTime: 5 },
    ];
    const { lastFrame } = render(<ReviewSummary results={results} />);
    expect(lastFrame()).toContain("3");
  });

  it("renders quality breakdown", () => {
    const results = [
      { cardId: "1", quality: AnswerQuality.Perfect, responseTime: 1 },
      { cardId: "2", quality: AnswerQuality.Perfect, responseTime: 1 },
      { cardId: "3", quality: AnswerQuality.Correct, responseTime: 2 },
      { cardId: "4", quality: AnswerQuality.Partial, responseTime: 3 },
      { cardId: "5", quality: AnswerQuality.Wrong, responseTime: 4 },
    ];
    const { lastFrame } = render(<ReviewSummary results={results} />);
    const frame = lastFrame();
    expect(frame).toContain("Perfect: 2");
    expect(frame).toContain("Correct: 1");
    expect(frame).toContain("Partial: 1");
    expect(frame).toContain("Wrong: 1");
  });

  it("counts Timeout as Wrong", () => {
    const results = [
      { cardId: "1", quality: AnswerQuality.Timeout, responseTime: 30 },
    ];
    const { lastFrame } = render(<ReviewSummary results={results} />);
    expect(lastFrame()).toContain("Wrong: 1");
  });

  it("calculates accuracy (perfect + correct + partial / total)", () => {
    const results = [
      { cardId: "1", quality: AnswerQuality.Perfect, responseTime: 1 },
      { cardId: "2", quality: AnswerQuality.Correct, responseTime: 1 },
      { cardId: "3", quality: AnswerQuality.Partial, responseTime: 1 },
      { cardId: "4", quality: AnswerQuality.Wrong, responseTime: 1 },
    ];
    const { lastFrame } = render(<ReviewSummary results={results} />);
    // 3/4 = 75%
    expect(lastFrame()).toContain("75%");
  });

  it("calculates average response time", () => {
    const results = [
      { cardId: "1", quality: AnswerQuality.Perfect, responseTime: 2 },
      { cardId: "2", quality: AnswerQuality.Perfect, responseTime: 4 },
    ];
    const { lastFrame } = render(<ReviewSummary results={results} />);
    expect(lastFrame()).toContain("3.0s");
  });

  it("renders XP earned when provided", () => {
    const { lastFrame } = render(<ReviewSummary results={[]} xpEarned={150} />);
    expect(lastFrame()).toContain("+150");
  });

  it("renders gold earned when provided", () => {
    const { lastFrame } = render(<ReviewSummary results={[]} goldEarned={50} />);
    expect(lastFrame()).toContain("+50");
  });

  it("renders level up message when leveled up", () => {
    const { lastFrame } = render(
      <ReviewSummary results={[]} leveledUp={true} newLevel={5} />,
    );
    const frame = lastFrame();
    expect(frame).toContain("LEVEL UP!");
    expect(frame).toContain("level 5");
  });

  it("does not render XP/gold when not provided", () => {
    const { lastFrame } = render(<ReviewSummary results={[]} />);
    const frame = lastFrame();
    expect(frame).not.toContain("XP earned");
    expect(frame).not.toContain("Gold:");
  });
});
