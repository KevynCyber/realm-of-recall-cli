import AdmZip from "adm-zip";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { CardType, type Card, type Deck } from "../types/index.js";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<div>/gi, "\n")
    .replace(/<\/div>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/\[sound:[^\]]+\]/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildClozeFront(
  text: string,
  clozeNum: number,
): { front: string; back: string } {
  // Extract the answer for this cloze number
  let answer = "";
  const targetPattern = new RegExp(
    `\\{\\{c${clozeNum}::([^}]*?)(?:::([^}]*?))?\\}\\}`,
    "g",
  );
  const targetMatch = targetPattern.exec(text);
  if (targetMatch) {
    answer = targetMatch[1];
  }

  // Build front: replace target cloze with [...] or [hint], reveal others
  let front = text.replace(
    /\{\{c(\d+)::([^}]*?)(?:::([^}]*?))?\}\}/g,
    (_, num, ans, hint) => {
      if (parseInt(num) === clozeNum) {
        return hint ? `[${hint}]` : "[...]";
      }
      return ans;
    },
  );

  return { front: stripHtml(front), back: stripHtml(answer) };
}

export function importApkg(filePath: string): { deck: Deck; cards: Card[] } {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  let dbEntry = entries.find((e) => e.entryName === "collection.anki2");
  if (!dbEntry) {
    dbEntry = entries.find((e) => e.entryName === "collection.anki21");
  }
  if (!dbEntry) {
    throw new Error(
      "Invalid .apkg file: no collection.anki2 or collection.anki21 found",
    );
  }

  const tmpPath = join(tmpdir(), `ror-apkg-${randomUUID()}.sqlite`);
  try {
    writeFileSync(tmpPath, dbEntry.getData());
    const db = new Database(tmpPath);

    // Read collection metadata
    const col = db.prepare("SELECT models, decks FROM col").get() as {
      models: string;
      decks: string;
    };
    const models: Record<
      string,
      { name: string; type: number; flds: Array<{ name: string }> }
    > = JSON.parse(col.models);
    const ankiDecks: Record<string, { name: string }> = JSON.parse(col.decks);

    // Read notes and cards
    const notes = db
      .prepare("SELECT id, mid, flds FROM notes")
      .all() as Array<{
      id: number;
      mid: number;
      flds: string;
    }>;
    const ankiCards = db
      .prepare("SELECT nid, did, ord FROM cards")
      .all() as Array<{
      nid: number;
      did: number;
      ord: number;
    }>;

    db.close();

    if (notes.length === 0) {
      throw new Error("Empty .apkg file: no notes found");
    }

    // Build note-to-deck mapping (first card for each note determines deck)
    const noteDeckMap = new Map<number, number>();
    for (const card of ankiCards) {
      if (!noteDeckMap.has(card.nid)) {
        noteDeckMap.set(card.nid, card.did);
      }
    }

    // Find the primary deck name (first non-Default deck, or fallback to first deck used)
    let deckName = "Imported Deck";
    const usedDeckIds = new Set(noteDeckMap.values());
    for (const did of usedDeckIds) {
      const d = ankiDecks[String(did)];
      if (d && d.name !== "Default") {
        deckName = d.name;
        break;
      }
    }
    // If all decks are Default, use it
    if (deckName === "Imported Deck" && usedDeckIds.size > 0) {
      const firstDid = usedDeckIds.values().next().value;
      const d = ankiDecks[String(firstDid)];
      if (d) deckName = d.name;
    }

    const deckId = randomUUID();
    const deck: Deck = {
      id: deckId,
      name: deckName,
      description: `Imported from Anki package`,
      createdAt: new Date().toISOString(),
      equipped: true,
    };

    const cards: Card[] = [];

    for (const note of notes) {
      const model = models[String(note.mid)];
      if (!model) continue;

      const fields = note.flds.split("\x1f");

      if (model.type === 1) {
        // Cloze note: find all unique cloze numbers
        const clozeNums = new Set<number>();
        const clozePattern = /\{\{c(\d+)::/g;
        let match;
        while ((match = clozePattern.exec(fields[0])) !== null) {
          clozeNums.add(parseInt(match[1]));
        }

        for (const num of clozeNums) {
          const { front, back } = buildClozeFront(fields[0], num);
          cards.push({
            id: randomUUID(),
            front,
            back,
            acceptableAnswers: [back],
            type: CardType.ClozeDeletion,
            deckId,
          });
        }
      } else {
        // Standard note: first field = front, second = back
        const front = stripHtml(fields[0] ?? "");
        const back = stripHtml(fields[1] ?? "");
        cards.push({
          id: randomUUID(),
          front,
          back,
          acceptableAnswers: [back],
          type: CardType.Basic,
          deckId,
        });
      }
    }

    return { deck, cards };
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
