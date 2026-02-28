import { describe, it, expect } from "vitest";
import {
  generateHint,
  getMaxHintLevel,
  isFullReveal,
} from "../../../src/core/cards/HintGenerator.js";

describe("generateHint", () => {
  it("level 0: reveals only the first letter", () => {
    expect(generateHint("Photosynthesis", 0)).toBe("P_____________");
  });

  it("level 0: keeps spaces visible", () => {
    expect(generateHint("Hello World", 0)).toBe("H____ _____");
  });

  it("level 1: reveals first letter + every 3rd letter", () => {
    // P(0)h(1)o(2)t(3)o(4)s(5)y(6)n(7)t(8)h(9)e(10)s(11)i(12)s(13)
    const hint = generateHint("Photosynthesis", 1);
    expect(hint[0]).toBe("P"); // index 0 always revealed
    expect(hint[3]).toBe("t"); // index 3, 3%3===0
    expect(hint[6]).toBe("y"); // index 6, 6%3===0
    expect(hint[9]).toBe("h"); // index 9, 9%3===0
    expect(hint[12]).toBe("i"); // index 12, 12%3===0
    expect(hint[1]).toBe("_"); // index 1, not revealed
    expect(hint[2]).toBe("_"); // index 2, not revealed
  });

  it("level 2: reveals first letter + every other letter", () => {
    // Indices: 0=P, 1=_, 2=o, 3=_, 4=o, 5=_, 6=y, 7=_, 8=h, 9=_, 10=s, 11=_, 12=s, 13=_
    const hint = generateHint("Photosynthesis", 2);
    expect(hint[0]).toBe("P"); // index 0 always
    expect(hint[2]).toBe("o"); // even index
    expect(hint[4]).toBe("o"); // even index
    expect(hint[1]).toBe("_"); // odd index
    expect(hint[3]).toBe("_"); // odd index
  });

  it("level 3: returns full answer", () => {
    expect(generateHint("Photosynthesis", 3)).toBe("Photosynthesis");
  });

  it("level above 3: returns full answer", () => {
    expect(generateHint("Test", 5)).toBe("Test");
  });

  it("handles empty string", () => {
    expect(generateHint("", 0)).toBe("");
  });

  it("handles single character", () => {
    expect(generateHint("A", 0)).toBe("A");
    expect(generateHint("A", 1)).toBe("A");
  });

  it("preserves spaces in multi-word answers at all levels", () => {
    const answer = "New York City";
    for (let level = 0; level <= 2; level++) {
      const hint = generateHint(answer, level);
      expect(hint[3]).toBe(" ");
      expect(hint[8]).toBe(" ");
    }
  });

  it("produces progressively more revealed hints", () => {
    const answer = "Mitochondria";
    const hints = [0, 1, 2, 3].map((level) => generateHint(answer, level));
    const countRevealed = (s: string) => s.split("").filter((c) => c !== "_").length;

    for (let i = 0; i < hints.length - 1; i++) {
      expect(countRevealed(hints[i])).toBeLessThanOrEqual(countRevealed(hints[i + 1]));
    }
    expect(countRevealed(hints[3])).toBe(answer.length);
  });

  it("maintains original string length", () => {
    const answer = "Test Answer";
    for (let level = 0; level <= 3; level++) {
      expect(generateHint(answer, level).length).toBe(answer.length);
    }
  });
});

describe("getMaxHintLevel", () => {
  it("returns 3", () => {
    expect(getMaxHintLevel()).toBe(3);
  });
});

describe("isFullReveal", () => {
  it("returns false for levels 0-2", () => {
    expect(isFullReveal(0)).toBe(false);
    expect(isFullReveal(1)).toBe(false);
    expect(isFullReveal(2)).toBe(false);
  });

  it("returns true for level 3+", () => {
    expect(isFullReveal(3)).toBe(true);
    expect(isFullReveal(4)).toBe(true);
    expect(isFullReveal(10)).toBe(true);
  });
});
