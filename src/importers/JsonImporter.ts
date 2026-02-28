import fs from "fs";
import crypto from "crypto";
import type { Card, Deck } from "../types/index.js";
import { CardType } from "../types/index.js";

interface JsonDeck {
  name: string;
  description?: string;
  cards: Array<{
    front: string;
    back: string;
    acceptableAnswers?: string[];
    type?: string;
  }>;
}

export function importJson(filePath: string): { deck: Deck; cards: Card[] } {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data: JsonDeck = JSON.parse(raw);

  const deckId = crypto.randomUUID();
  const deck: Deck = {
    id: deckId,
    name: data.name,
    description: data.description ?? "",
    createdAt: new Date().toISOString(),
    equipped: true,
  };

  const cards: Card[] = data.cards.map((c) => ({
    id: crypto.randomUUID(),
    front: c.front,
    back: c.back,
    acceptableAnswers: c.acceptableAnswers ?? [c.back],
    type: parseCardType(c.type),
    deckId,
  }));

  return { deck, cards };
}

function parseCardType(type?: string): CardType {
  if (!type) return CardType.Basic;
  const lower = type.toLowerCase();
  if (lower === "cloze" || lower === "cloze_deletion") return CardType.ClozeDeletion;
  if (lower === "multiple_choice") return CardType.MultipleChoice;
  return CardType.Basic;
}
