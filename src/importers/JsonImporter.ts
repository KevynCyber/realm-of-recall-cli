import fs from "fs";
import crypto from "crypto";
import { z } from "zod";
import type { Card, Deck } from "../types/index.js";
import { CardType } from "../types/index.js";

const JsonCardSchema = z.object({
  front: z.string().min(1, "Card front must be a non-empty string"),
  back: z.string().min(1, "Card back must be a non-empty string"),
  acceptableAnswers: z.array(z.string()).optional(),
  type: z.string().optional(),
});

const JsonDeckSchema = z.object({
  name: z.string().min(1, "Deck name must be a non-empty string"),
  description: z.string().optional(),
  cards: z.array(JsonCardSchema).min(1, "Deck must contain at least one card"),
});

export type JsonDeck = z.infer<typeof JsonDeckSchema>;

export function importJson(filePath: string): { deck: Deck; cards: Card[] } {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  const result = JsonDeckSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid deck JSON: ${issues}`);
  }
  const data = result.data;

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
