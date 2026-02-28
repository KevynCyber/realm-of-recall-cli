import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import AdmZip from "adm-zip";
import Database from "better-sqlite3";
import { importApkg } from "../../src/importers/ApkgImporter.js";
import { CardType } from "../../src/types/index.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ror-apkg-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true });
});

interface TestNote {
  id: number;
  mid: number;
  flds: string;
}

interface TestCard {
  nid: number;
  did: number;
  ord: number;
}

interface TestModel {
  id: number;
  name: string;
  type: number;
  flds: Array<{ name: string }>;
}

interface TestDeck {
  id: number;
  name: string;
}

function createTestApkg(
  tmpDirPath: string,
  options: {
    notes: TestNote[];
    models: TestModel[];
    decks: TestDeck[];
    cards: TestCard[];
    dbName?: string;
  },
): string {
  const dbPath = join(tmpDirPath, "collection.anki2");
  const db = new Database(dbPath);

  // Create schema v11 tables
  db.exec(`
    CREATE TABLE col (
      id INTEGER PRIMARY KEY,
      crt INTEGER,
      mod INTEGER,
      scm INTEGER,
      ver INTEGER,
      dty INTEGER,
      usn INTEGER,
      ls INTEGER,
      conf TEXT,
      models TEXT,
      decks TEXT,
      dconf TEXT,
      tags TEXT
    );
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY,
      guid TEXT,
      mid INTEGER,
      mod INTEGER,
      usn INTEGER,
      tags TEXT,
      flds TEXT,
      sfld TEXT,
      csum INTEGER,
      flags INTEGER,
      data TEXT
    );
    CREATE TABLE cards (
      id INTEGER PRIMARY KEY,
      nid INTEGER,
      did INTEGER,
      ord INTEGER,
      mod INTEGER,
      usn INTEGER,
      type INTEGER,
      queue INTEGER,
      due INTEGER,
      ivl INTEGER,
      factor INTEGER,
      reps INTEGER,
      lapses INTEGER,
      left INTEGER,
      odue INTEGER,
      odid INTEGER,
      flags INTEGER,
      data TEXT
    );
  `);

  // Build models JSON
  const modelsObj: Record<string, object> = {};
  for (const m of options.models) {
    modelsObj[String(m.id)] = {
      name: m.name,
      type: m.type,
      flds: m.flds,
    };
  }

  // Build decks JSON
  const decksObj: Record<string, object> = {};
  for (const d of options.decks) {
    decksObj[String(d.id)] = { name: d.name };
  }

  db.prepare(
    `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
     VALUES (1, 0, 0, 0, 11, 0, 0, 0, '{}', ?, ?, '{}', '{}')`,
  ).run(JSON.stringify(modelsObj), JSON.stringify(decksObj));

  const insertNote = db.prepare(
    `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
     VALUES (?, '', ?, 0, 0, '', ?, '', 0, 0, '')`,
  );
  for (const n of options.notes) {
    insertNote.run(n.id, n.mid, n.flds);
  }

  const insertCard = db.prepare(
    `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
     VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '')`,
  );
  let cardId = 1;
  for (const c of options.cards) {
    insertCard.run(cardId++, c.nid, c.did, c.ord);
  }

  db.close();

  // Package as .apkg (ZIP)
  const zip = new AdmZip();
  const entryName = options.dbName ?? "collection.anki2";
  zip.addLocalFile(dbPath, "", entryName);
  const apkgPath = join(tmpDirPath, "test.apkg");
  zip.writeZip(apkgPath);

  return apkgPath;
}

describe("ApkgImporter", () => {
  it("imports a basic front/back note", () => {
    const apkgPath = createTestApkg(tmpDir, {
      models: [
        {
          id: 1000,
          name: "Basic",
          type: 0,
          flds: [{ name: "Front" }, { name: "Back" }],
        },
      ],
      decks: [{ id: 1, name: "My Deck" }],
      notes: [{ id: 1, mid: 1000, flds: "What is 2+2?\x1f4" }],
      cards: [{ nid: 1, did: 1, ord: 0 }],
    });

    const { deck, cards } = importApkg(apkgPath);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("What is 2+2?");
    expect(cards[0].back).toBe("4");
    expect(cards[0].acceptableAnswers).toEqual(["4"]);
    expect(cards[0].type).toBe(CardType.Basic);
    expect(cards[0].deckId).toBe(deck.id);
  });

  it("imports multiple basic notes", () => {
    const apkgPath = createTestApkg(tmpDir, {
      models: [
        {
          id: 1000,
          name: "Basic",
          type: 0,
          flds: [{ name: "Front" }, { name: "Back" }],
        },
      ],
      decks: [{ id: 1, name: "Geography" }],
      notes: [
        { id: 1, mid: 1000, flds: "Capital of France?\x1fParis" },
        { id: 2, mid: 1000, flds: "Capital of Germany?\x1fBerlin" },
        { id: 3, mid: 1000, flds: "Capital of Japan?\x1fTokyo" },
      ],
      cards: [
        { nid: 1, did: 1, ord: 0 },
        { nid: 2, did: 1, ord: 0 },
        { nid: 3, did: 1, ord: 0 },
      ],
    });

    const { deck, cards } = importApkg(apkgPath);
    expect(deck.name).toBe("Geography");
    expect(cards).toHaveLength(3);
    expect(cards[0].front).toBe("Capital of France?");
    expect(cards[0].back).toBe("Paris");
    expect(cards[1].front).toBe("Capital of Germany?");
    expect(cards[1].back).toBe("Berlin");
    expect(cards[2].front).toBe("Capital of Japan?");
    expect(cards[2].back).toBe("Tokyo");
  });

  it("imports a cloze deletion note", () => {
    const apkgPath = createTestApkg(tmpDir, {
      models: [
        {
          id: 2000,
          name: "Cloze",
          type: 1,
          flds: [{ name: "Text" }],
        },
      ],
      decks: [{ id: 1, name: "Science" }],
      notes: [
        {
          id: 1,
          mid: 2000,
          flds: "The {{c1::sun}} is a star",
        },
      ],
      cards: [{ nid: 1, did: 1, ord: 0 }],
    });

    const { cards } = importApkg(apkgPath);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("The [...] is a star");
    expect(cards[0].back).toBe("sun");
    expect(cards[0].acceptableAnswers).toEqual(["sun"]);
    expect(cards[0].type).toBe(CardType.ClozeDeletion);
  });

  it("produces multiple cards from multiple cloze deletions", () => {
    const apkgPath = createTestApkg(tmpDir, {
      models: [
        {
          id: 2000,
          name: "Cloze",
          type: 1,
          flds: [{ name: "Text" }],
        },
      ],
      decks: [{ id: 1, name: "Biology" }],
      notes: [
        {
          id: 1,
          mid: 2000,
          flds: "{{c1::Mitochondria}} is the {{c2::powerhouse}} of the cell",
        },
      ],
      cards: [
        { nid: 1, did: 1, ord: 0 },
        { nid: 1, did: 1, ord: 1 },
      ],
    });

    const { cards } = importApkg(apkgPath);
    expect(cards).toHaveLength(2);

    // First card: c1 is blanked, c2 is revealed
    expect(cards[0].front).toBe("[...] is the powerhouse of the cell");
    expect(cards[0].back).toBe("Mitochondria");

    // Second card: c1 is revealed, c2 is blanked
    expect(cards[1].front).toBe("Mitochondria is the [...] of the cell");
    expect(cards[1].back).toBe("powerhouse");
  });

  it("handles cloze deletion with hint", () => {
    const apkgPath = createTestApkg(tmpDir, {
      models: [
        {
          id: 2000,
          name: "Cloze",
          type: 1,
          flds: [{ name: "Text" }],
        },
      ],
      decks: [{ id: 1, name: "Vocab" }],
      notes: [
        {
          id: 1,
          mid: 2000,
          flds: "The {{c1::cat::animal}} sat on the mat",
        },
      ],
      cards: [{ nid: 1, did: 1, ord: 0 }],
    });

    const { cards } = importApkg(apkgPath);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("The [animal] sat on the mat");
    expect(cards[0].back).toBe("cat");
  });

  it("strips HTML tags from fields", () => {
    const apkgPath = createTestApkg(tmpDir, {
      models: [
        {
          id: 1000,
          name: "Basic",
          type: 0,
          flds: [{ name: "Front" }, { name: "Back" }],
        },
      ],
      decks: [{ id: 1, name: "HTML Test" }],
      notes: [
        {
          id: 1,
          mid: 1000,
          flds:
            "<b>Bold question</b><br>line two\x1f<i>italic</i> answer<br/><img src='img.png'>",
        },
      ],
      cards: [{ nid: 1, did: 1, ord: 0 }],
    });

    const { cards } = importApkg(apkgPath);
    expect(cards[0].front).toBe("Bold question\nline two");
    expect(cards[0].back).toBe("italic answer");
  });

  it("strips media references and HTML entities", () => {
    const apkgPath = createTestApkg(tmpDir, {
      models: [
        {
          id: 1000,
          name: "Basic",
          type: 0,
          flds: [{ name: "Front" }, { name: "Back" }],
        },
      ],
      decks: [{ id: 1, name: "Media Test" }],
      notes: [
        {
          id: 1,
          mid: 1000,
          flds:
            "Listen [sound:audio.mp3]&amp; answer\x1f5 &gt; 3 &amp; 2 &lt; 4",
        },
      ],
      cards: [{ nid: 1, did: 1, ord: 0 }],
    });

    const { cards } = importApkg(apkgPath);
    expect(cards[0].front).toBe("Listen & answer");
    expect(cards[0].back).toBe("5 > 3 & 2 < 4");
  });

  it("uses the Anki deck name, not Default", () => {
    const apkgPath = createTestApkg(tmpDir, {
      models: [
        {
          id: 1000,
          name: "Basic",
          type: 0,
          flds: [{ name: "Front" }, { name: "Back" }],
        },
      ],
      decks: [
        { id: 1, name: "Default" },
        { id: 2, name: "Spanish Vocabulary" },
      ],
      notes: [{ id: 1, mid: 1000, flds: "Hola\x1fHello" }],
      cards: [{ nid: 1, did: 2, ord: 0 }],
    });

    const { deck } = importApkg(apkgPath);
    expect(deck.name).toBe("Spanish Vocabulary");
    expect(deck.equipped).toBe(true);
    expect(deck.description).toBe("Imported from Anki package");
  });

  it("throws on empty deck (no notes)", () => {
    const apkgPath = createTestApkg(tmpDir, {
      models: [
        {
          id: 1000,
          name: "Basic",
          type: 0,
          flds: [{ name: "Front" }, { name: "Back" }],
        },
      ],
      decks: [{ id: 1, name: "Empty" }],
      notes: [],
      cards: [],
    });

    expect(() => importApkg(apkgPath)).toThrow("Empty .apkg file");
  });

  it("throws on missing collection database", () => {
    const zip = new AdmZip();
    zip.addFile("media", Buffer.from("{}"));
    const apkgPath = join(tmpDir, "bad.apkg");
    zip.writeZip(apkgPath);

    expect(() => importApkg(apkgPath)).toThrow(
      "Invalid .apkg file: no collection.anki2 or collection.anki21 found",
    );
  });

  it("falls back to collection.anki21", () => {
    const apkgPath = createTestApkg(tmpDir, {
      models: [
        {
          id: 1000,
          name: "Basic",
          type: 0,
          flds: [{ name: "Front" }, { name: "Back" }],
        },
      ],
      decks: [{ id: 1, name: "Fallback Deck" }],
      notes: [{ id: 1, mid: 1000, flds: "Q\x1fA" }],
      cards: [{ nid: 1, did: 1, ord: 0 }],
      dbName: "collection.anki21",
    });

    const { deck, cards } = importApkg(apkgPath);
    expect(deck.name).toBe("Fallback Deck");
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("Q");
    expect(cards[0].back).toBe("A");
  });

  it("sets deck createdAt to ISO string", () => {
    const apkgPath = createTestApkg(tmpDir, {
      models: [
        {
          id: 1000,
          name: "Basic",
          type: 0,
          flds: [{ name: "Front" }, { name: "Back" }],
        },
      ],
      decks: [{ id: 1, name: "Timestamp Test" }],
      notes: [{ id: 1, mid: 1000, flds: "Q\x1fA" }],
      cards: [{ nid: 1, did: 1, ord: 0 }],
    });

    const { deck } = importApkg(apkgPath);
    // Verify it's a valid ISO date string
    expect(new Date(deck.createdAt).toISOString()).toBe(deck.createdAt);
  });

  it("assigns unique IDs to cards and deck", () => {
    const apkgPath = createTestApkg(tmpDir, {
      models: [
        {
          id: 1000,
          name: "Basic",
          type: 0,
          flds: [{ name: "Front" }, { name: "Back" }],
        },
      ],
      decks: [{ id: 1, name: "ID Test" }],
      notes: [
        { id: 1, mid: 1000, flds: "Q1\x1fA1" },
        { id: 2, mid: 1000, flds: "Q2\x1fA2" },
      ],
      cards: [
        { nid: 1, did: 1, ord: 0 },
        { nid: 2, did: 1, ord: 0 },
      ],
    });

    const { deck, cards } = importApkg(apkgPath);
    expect(deck.id).toBeTruthy();
    expect(cards[0].id).toBeTruthy();
    expect(cards[1].id).toBeTruthy();
    expect(cards[0].id).not.toBe(cards[1].id);
    expect(cards[0].deckId).toBe(deck.id);
    expect(cards[1].deckId).toBe(deck.id);
  });
});
