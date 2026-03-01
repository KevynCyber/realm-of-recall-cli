import { describe, it, expect } from "vitest";
import {
  isPretestEligible,
  getPretestRevealMessage,
  PRETEST_FLAG,
} from "../../../src/core/review/Pretesting.js";

describe("isPretestEligible", () => {
  it("returns true for null card state (never reviewed)", () => {
    expect(isPretestEligible(null)).toBe(true);
  });

  it("returns true for 'new' card state", () => {
    expect(isPretestEligible("new")).toBe(true);
  });

  it("returns false for 'learning' card state", () => {
    expect(isPretestEligible("learning")).toBe(false);
  });

  it("returns false for 'review' card state", () => {
    expect(isPretestEligible("review")).toBe(false);
  });

  it("returns false for 'relearning' card state", () => {
    expect(isPretestEligible("relearning")).toBe(false);
  });

  it("returns false if already pretested this session", () => {
    expect(isPretestEligible("new", true)).toBe(false);
    expect(isPretestEligible(null, true)).toBe(false);
  });
});

describe("getPretestRevealMessage", () => {
  it("shows encouragement when pretest was correct", () => {
    const msg = getPretestRevealMessage("Paris", true);
    expect(msg).toContain("Paris");
    expect(msg).toContain("already knew");
  });

  it("shows the correct answer when pretest was wrong", () => {
    const msg = getPretestRevealMessage("Paris", false);
    expect(msg).toContain("Paris");
    expect(msg).toContain("correct answer");
    expect(msg).toContain("help you remember");
  });
});

describe("PRETEST_FLAG", () => {
  it("is the string 'pretest'", () => {
    expect(PRETEST_FLAG).toBe("pretest");
  });
});
