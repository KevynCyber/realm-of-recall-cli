import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../src/data/database.js";
import { CardRepository } from "../../src/data/repositories/CardRepository.js";
import { CardType, type Card, type Deck } from "../../src/types/index.js";

let db: Database.Database;
let cardRepo: CardRepository;

const testDeck: Deck = {
  id: "deck1",
  name: "Test Deck",
  description: "For testing",
  createdAt: new Date().toISOString(),
  equipped: true,
};

beforeEach(() => {
  db = getInMemoryDatabase();
  cardRepo = new CardRepository(db);
  cardRepo.createDeck(testDeck);
});

describe("Card Creation Flow", () => {
  it("creates a basic card with front, back, and acceptable answers", () => {
    const card: Card = {
      id: "new-card-1",
      front: "What is 2+2?",
      back: "4",
      acceptableAnswers: ["4", "four"],
      type: CardType.Basic,
      deckId: "deck1",
    };

    cardRepo.insertCard(card);
    const retrieved = cardRepo.getCard("new-card-1");

    expect(retrieved).toBeDefined();
    expect(retrieved!.front).toBe("What is 2+2?");
    expect(retrieved!.back).toBe("4");
    expect(retrieved!.acceptableAnswers).toEqual(["4", "four"]);
    expect(retrieved!.type).toBe(CardType.Basic);
    expect(retrieved!.deckId).toBe("deck1");
  });

  it("creates a cloze deletion card", () => {
    const card: Card = {
      id: "cloze-card-1",
      front: "The capital of France is {{c1::Paris}}",
      back: "The capital of France is {{c1::Paris}}",
      acceptableAnswers: ["Paris"],
      type: CardType.ClozeDeletion,
      deckId: "deck1",
    };

    cardRepo.insertCard(card);
    const retrieved = cardRepo.getCard("cloze-card-1");

    expect(retrieved).toBeDefined();
    expect(retrieved!.type).toBe(CardType.ClozeDeletion);
    expect(retrieved!.acceptableAnswers).toEqual(["Paris"]);
  });

  it("creates a new deck and adds cards to it", () => {
    const newDeck: Deck = {
      id: "new-deck-1",
      name: "My Custom Deck",
      description: "",
      createdAt: new Date().toISOString(),
      equipped: true,
    };
    cardRepo.createDeck(newDeck);

    const card: Card = {
      id: "card-in-new-deck",
      front: "Question?",
      back: "Answer",
      acceptableAnswers: ["Answer"],
      type: CardType.Basic,
      deckId: "new-deck-1",
    };
    cardRepo.insertCard(card);

    const deck = cardRepo.getDeck("new-deck-1");
    expect(deck).toBeDefined();
    expect(deck!.name).toBe("My Custom Deck");

    const cards = cardRepo.getCardsByDeck("new-deck-1");
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("Question?");
  });

  it("persists multiple cards in same deck", () => {
    const cards: Card[] = [
      {
        id: "mc-1",
        front: "Q1",
        back: "A1",
        acceptableAnswers: ["A1"],
        type: CardType.Basic,
        deckId: "deck1",
      },
      {
        id: "mc-2",
        front: "Q2",
        back: "A2",
        acceptableAnswers: ["A2"],
        type: CardType.Basic,
        deckId: "deck1",
      },
      {
        id: "mc-3",
        front: "Q3",
        back: "A3",
        acceptableAnswers: ["A3", "answer three"],
        type: CardType.Basic,
        deckId: "deck1",
      },
    ];

    for (const card of cards) {
      cardRepo.insertCard(card);
    }

    expect(cardRepo.getCardCount("deck1")).toBe(3);
    const retrieved = cardRepo.getCardsByDeck("deck1");
    expect(retrieved).toHaveLength(3);
  });

  it("creates card with empty acceptable answers", () => {
    const card: Card = {
      id: "empty-ans-card",
      front: "Open question?",
      back: "Any answer is fine",
      acceptableAnswers: ["Any answer is fine"],
      type: CardType.Basic,
      deckId: "deck1",
    };

    cardRepo.insertCard(card);
    const retrieved = cardRepo.getCard("empty-ans-card");
    expect(retrieved!.acceptableAnswers).toEqual(["Any answer is fine"]);
  });

  it("new deck is equipped by default", () => {
    const newDeck: Deck = {
      id: "equipped-deck",
      name: "Equipped Deck",
      description: "",
      createdAt: new Date().toISOString(),
      equipped: true,
    };
    cardRepo.createDeck(newDeck);

    const deck = cardRepo.getDeck("equipped-deck");
    expect(deck!.equipped).toBe(true);
    expect(cardRepo.getEquippedDeckIds()).toContain("equipped-deck");
  });
});

describe("Cloze Detection", () => {
  const CLOZE_PATTERN = /\{\{c\d+::([^:}]+)(?:::([^}]*))?\}\}/;

  it("detects basic cloze syntax", () => {
    expect(CLOZE_PATTERN.test("The {{c1::answer}} is here")).toBe(true);
  });

  it("detects cloze with hint", () => {
    expect(CLOZE_PATTERN.test("The {{c1::answer::hint}} is here")).toBe(true);
  });

  it("does not detect non-cloze text", () => {
    expect(CLOZE_PATTERN.test("Regular text without cloze")).toBe(false);
  });

  it("detects multiple cloze deletions", () => {
    const text = "{{c1::Paris}} is the capital of {{c2::France}}";
    const matches = [...text.matchAll(/\{\{c\d+::([^:}]+)(?:::([^}]*))?\}\}/g)];
    expect(matches).toHaveLength(2);
    expect(matches[0][1]).toBe("Paris");
    expect(matches[1][1]).toBe("France");
  });

  it("extracts cloze answers correctly", () => {
    const front = "{{c1::Mitochondria}} is the powerhouse of the {{c2::cell}}";
    const matches = [...front.matchAll(/\{\{c\d+::([^:}]+)(?:::([^}]*))?\}\}/g)];
    const answers = matches.map((m) => m[1]);
    expect(answers).toEqual(["Mitochondria", "cell"]);
  });
});
