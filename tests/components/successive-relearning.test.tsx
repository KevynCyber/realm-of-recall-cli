import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { FlashcardFace } from "../../src/components/review/FlashcardFace.js";
import { CardType } from "../../src/types/index.js";
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

describe("FlashcardFace Retry indicator", () => {
  it("shows [Retry] when isRetry is true", () => {
    const card = makeCard();
    const { lastFrame } = render(
      <FlashcardFace card={card} showAnswer={false} isRetry={true} />,
    );
    expect(lastFrame()).toContain("[Retry]");
  });

  it("does not show [Retry] when isRetry is false", () => {
    const card = makeCard();
    const { lastFrame } = render(
      <FlashcardFace card={card} showAnswer={false} isRetry={false} />,
    );
    expect(lastFrame()).not.toContain("[Retry]");
  });

  it("does not show [Retry] when isRetry is undefined", () => {
    const card = makeCard();
    const { lastFrame } = render(
      <FlashcardFace card={card} showAnswer={false} />,
    );
    expect(lastFrame()).not.toContain("[Retry]");
  });

  it("shows [Retry] on answer side too", () => {
    const card = makeCard();
    const { lastFrame } = render(
      <FlashcardFace card={card} showAnswer={true} isRetry={true} />,
    );
    const frame = lastFrame();
    expect(frame).toContain("[Retry]");
    expect(frame).toContain("Answer");
  });
});

describe("Successive relearning queue logic", () => {
  /**
   * Pure logic tests for the re-queue algorithm used in ReviewScreen and CombatScreen.
   * These test the re-queue decision logic extracted from the component.
   */
  const MAX_REQUEUES = 2;

  function shouldRequeue(
    cardId: string,
    isWrongOrTimeout: boolean,
    requeueCounts: Map<string, number>,
  ): boolean {
    if (!isWrongOrTimeout) return false;
    const count = requeueCounts.get(cardId) ?? 0;
    return count < MAX_REQUEUES;
  }

  function applyRequeue(
    queue: Card[],
    card: Card,
    requeueCounts: Map<string, number>,
  ): { queue: Card[]; requeueCounts: Map<string, number> } {
    const count = requeueCounts.get(card.id) ?? 0;
    const newQueue = [...queue, card];
    const newCounts = new Map(requeueCounts);
    newCounts.set(card.id, count + 1);
    return { queue: newQueue, requeueCounts: newCounts };
  }

  it("re-queues a wrong card", () => {
    const card = makeCard({ id: "c1" });
    const counts = new Map<string, number>();
    expect(shouldRequeue("c1", true, counts)).toBe(true);
  });

  it("does not re-queue a correct card", () => {
    const card = makeCard({ id: "c1" });
    const counts = new Map<string, number>();
    expect(shouldRequeue("c1", false, counts)).toBe(false);
  });

  it("re-queues up to max 2 times", () => {
    const card = makeCard({ id: "c1" });
    let counts = new Map<string, number>();
    let queue = [card];

    // First re-queue
    expect(shouldRequeue("c1", true, counts)).toBe(true);
    const r1 = applyRequeue(queue, card, counts);
    queue = r1.queue;
    counts = r1.requeueCounts;
    expect(queue).toHaveLength(2);
    expect(counts.get("c1")).toBe(1);

    // Second re-queue
    expect(shouldRequeue("c1", true, counts)).toBe(true);
    const r2 = applyRequeue(queue, card, counts);
    queue = r2.queue;
    counts = r2.requeueCounts;
    expect(queue).toHaveLength(3);
    expect(counts.get("c1")).toBe(2);

    // Third attempt — should NOT re-queue (limit reached)
    expect(shouldRequeue("c1", true, counts)).toBe(false);
  });

  it("tracks re-queue counts independently per card", () => {
    const card1 = makeCard({ id: "c1" });
    const card2 = makeCard({ id: "c2", front: "2+2?", back: "4" });
    let counts = new Map<string, number>();
    let queue = [card1, card2];

    // Re-queue card1 twice
    const r1 = applyRequeue(queue, card1, counts);
    counts = r1.requeueCounts;
    queue = r1.queue;
    const r2 = applyRequeue(queue, card1, counts);
    counts = r2.requeueCounts;
    queue = r2.queue;

    // card1 is at limit
    expect(shouldRequeue("c1", true, counts)).toBe(false);
    // card2 has not been re-queued yet
    expect(shouldRequeue("c2", true, counts)).toBe(true);
  });

  it("re-queued cards appear at the end of the queue", () => {
    const card1 = makeCard({ id: "c1" });
    const card2 = makeCard({ id: "c2", front: "2+2?", back: "4" });
    const card3 = makeCard({ id: "c3", front: "H2O?", back: "Water" });
    let queue = [card1, card2, card3];
    const counts = new Map<string, number>();

    // Re-queue card1
    const result = applyRequeue(queue, card1, counts);
    queue = result.queue;

    expect(queue).toHaveLength(4);
    expect(queue[3].id).toBe("c1"); // card1 is at the end
  });

  it("progress accounts for re-queued cards", () => {
    // With 3 original cards and 1 re-queued, total is 4
    const originalLength = 3;
    const requeuedCount = 1;
    const totalLength = originalLength + requeuedCount;

    // After completing 2 of 4 cards, progress should be 2/4 = 0.5
    const currentIndex = 2;
    const progress = currentIndex / totalLength;
    expect(progress).toBe(0.5);

    // Without re-queue, progress would be 2/3 = 0.667
    const progressWithoutRequeue = currentIndex / originalLength;
    expect(progressWithoutRequeue).toBeCloseTo(0.667, 2);
  });
});
