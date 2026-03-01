import { describe, it, expect } from "vitest";
import { generatePartialCue } from "../../../src/core/cards/HintGenerator.js";

describe("generatePartialCue", () => {
  it("shows first letter and blanks for a single word", () => {
    expect(generatePartialCue("Paris")).toBe("P____");
  });

  it("handles multi-word answers", () => {
    expect(generatePartialCue("New York")).toBe("N__ Y___");
  });

  it("handles single character", () => {
    expect(generatePartialCue("A")).toBe("A");
  });

  it("handles empty string", () => {
    expect(generatePartialCue("")).toBe("");
  });

  it("handles two-letter word", () => {
    expect(generatePartialCue("Go")).toBe("G_");
  });

  it("handles three-word answer", () => {
    expect(generatePartialCue("Red Blue Green")).toBe("R__ B___ G____");
  });

  it("preserves spaces between words", () => {
    const result = generatePartialCue("The Quick Brown Fox");
    expect(result).toBe("T__ Q____ B____ F__");
  });
});
