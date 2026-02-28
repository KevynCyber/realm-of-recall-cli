import fs from "fs";
import crypto from "crypto";
import path from "path";
import type { Card, Deck } from "../types/index.js";
import { CardType } from "../types/index.js";

export function importCsv(filePath: string): { deck: Deck; cards: Card[] } {
  const raw = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();
  const separator = ext === ".tsv" ? "\t" : ",";

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error("Empty CSV/TSV file");
  }

  // Check if first line is a header
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes("front") || firstLine.includes("question");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const deckName = path.basename(filePath, path.extname(filePath));
  const deckId = crypto.randomUUID();
  const deck: Deck = {
    id: deckId,
    name: deckName,
    description: `Imported from ${path.basename(filePath)}`,
    createdAt: new Date().toISOString(),
    equipped: true,
  };

  const cards: Card[] = dataLines.map((line) => {
    const fields = parseCsvLine(line, separator);
    const front = fields[0] ?? "";
    const back = fields[1] ?? "";
    return {
      id: crypto.randomUUID(),
      front,
      back,
      acceptableAnswers: [back],
      type: CardType.Basic,
      deckId,
    };
  });

  return { deck, cards };
}

function parseCsvLine(line: string, sep: string): string[] {
  // Handle quoted fields
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}
