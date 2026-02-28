import { describe, it, expect } from "vitest";
import { parseCloze } from "../../src/core/cards/ClozeParser.js";

describe("ClozeParser", () => {
  it("parses single cloze deletion", () => {
    const result = parseCloze("The capital of France is {{c1::Paris}}");
    expect(result.displayText).toBe("The capital of France is [...]");
    expect(result.answers).toEqual(["Paris"]);
  });

  it("parses cloze with hint", () => {
    const result = parseCloze("The capital of France is {{c1::Paris::city}}");
    expect(result.displayText).toBe("The capital of France is [city]");
    expect(result.answers).toEqual(["Paris"]);
  });

  it("parses multiple cloze deletions", () => {
    const result = parseCloze(
      "{{c1::Paris}} is the capital of {{c2::France}}",
    );
    expect(result.displayText).toBe("[...] is the capital of [...]");
    expect(result.answers).toEqual(["Paris", "France"]);
  });

  it("handles empty string", () => {
    const result = parseCloze("");
    expect(result.displayText).toBe("");
    expect(result.answers).toEqual([]);
  });

  it("handles null", () => {
    const result = parseCloze(null as any);
    expect(result.displayText).toBe("");
    expect(result.answers).toEqual([]);
  });

  it("returns plain text unchanged", () => {
    const result = parseCloze("No cloze here");
    expect(result.displayText).toBe("No cloze here");
    expect(result.answers).toEqual([]);
  });
});
