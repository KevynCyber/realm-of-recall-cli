import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { importJson } from "../../src/importers/JsonImporter.js";
import { importCsv } from "../../src/importers/CsvImporter.js";
import { CardType } from "../../src/types/index.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ror-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

describe("JsonImporter", () => {
  it("imports a JSON deck", () => {
    const filePath = path.join(tmpDir, "test.json");
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        name: "Test Deck",
        description: "A test",
        cards: [
          { front: "Q1", back: "A1" },
          { front: "Q2", back: "A2", acceptableAnswers: ["A2", "a2"] },
        ],
      }),
    );

    const { deck, cards } = importJson(filePath);
    expect(deck.name).toBe("Test Deck");
    expect(cards).toHaveLength(2);
    expect(cards[0].front).toBe("Q1");
    expect(cards[0].acceptableAnswers).toEqual(["A1"]);
    expect(cards[1].acceptableAnswers).toEqual(["A2", "a2"]);
  });

  it("defaults acceptable answers to back", () => {
    const filePath = path.join(tmpDir, "test.json");
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        name: "Deck",
        cards: [{ front: "Q", back: "A" }],
      }),
    );

    const { cards } = importJson(filePath);
    expect(cards[0].acceptableAnswers).toEqual(["A"]);
    expect(cards[0].type).toBe(CardType.Basic);
  });

  it("rejects JSON missing name", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, JSON.stringify({ cards: [{ front: "Q", back: "A" }] }));
    expect(() => importJson(filePath)).toThrow("Invalid deck JSON");
  });

  it("rejects JSON with empty name", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, JSON.stringify({ name: "", cards: [{ front: "Q", back: "A" }] }));
    expect(() => importJson(filePath)).toThrow("Invalid deck JSON");
  });

  it("rejects JSON missing cards array", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, JSON.stringify({ name: "Deck" }));
    expect(() => importJson(filePath)).toThrow("Invalid deck JSON");
  });

  it("rejects JSON with empty cards array", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, JSON.stringify({ name: "Deck", cards: [] }));
    expect(() => importJson(filePath)).toThrow("Invalid deck JSON");
  });

  it("rejects card with empty front", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, JSON.stringify({ name: "Deck", cards: [{ front: "", back: "A" }] }));
    expect(() => importJson(filePath)).toThrow("Invalid deck JSON");
  });

  it("rejects card missing back", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, JSON.stringify({ name: "Deck", cards: [{ front: "Q" }] }));
    expect(() => importJson(filePath)).toThrow("Invalid deck JSON");
  });

  it("rejects non-object JSON", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, JSON.stringify("just a string"));
    expect(() => importJson(filePath)).toThrow("Invalid deck JSON");
  });

  it("rejects cards with wrong type for front", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, JSON.stringify({ name: "Deck", cards: [{ front: 123, back: "A" }] }));
    expect(() => importJson(filePath)).toThrow("Invalid deck JSON");
  });
});

describe("CsvImporter", () => {
  it("imports a CSV file", () => {
    const filePath = path.join(tmpDir, "test.csv");
    fs.writeFileSync(filePath, "front,back\nQ1,A1\nQ2,A2\n");

    const { deck, cards } = importCsv(filePath);
    expect(deck.name).toBe("test");
    expect(cards).toHaveLength(2);
    expect(cards[0].front).toBe("Q1");
    expect(cards[0].back).toBe("A1");
  });

  it("imports a TSV file", () => {
    const filePath = path.join(tmpDir, "test.tsv");
    fs.writeFileSync(filePath, "Q1\tA1\nQ2\tA2\n");

    const { cards } = importCsv(filePath);
    expect(cards).toHaveLength(2);
    expect(cards[0].front).toBe("Q1");
    expect(cards[0].back).toBe("A1");
  });

  it("handles CSV without header", () => {
    const filePath = path.join(tmpDir, "test.csv");
    fs.writeFileSync(filePath, "Q1,A1\nQ2,A2\n");

    const { cards } = importCsv(filePath);
    expect(cards).toHaveLength(2);
  });

  it("handles quoted fields with commas", () => {
    const filePath = path.join(tmpDir, "test.csv");
    fs.writeFileSync(filePath, '"What is 1+1?","2, two"\n');

    const { cards } = importCsv(filePath);
    expect(cards[0].front).toBe("What is 1+1?");
    expect(cards[0].back).toBe("2, two");
  });

  it("throws on empty file", () => {
    const filePath = path.join(tmpDir, "empty.csv");
    fs.writeFileSync(filePath, "");
    expect(() => importCsv(filePath)).toThrow("Empty CSV/TSV file");
  });
});
