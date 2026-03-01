import { describe, it, expect } from "vitest";
import {
  calculateWagerResult,
  summarizeWagers,
  WAGER_AMOUNTS,
  type WagerResult,
} from "../../../src/core/combat/WagerSystem.js";

describe("calculateWagerResult", () => {
  it("no wager returns zero delta", () => {
    const result = calculateWagerResult("none", true);
    expect(result.goldDelta).toBe(0);
    expect(result.amount).toBe(0);
  });

  it("correct low wager doubles the bet", () => {
    const result = calculateWagerResult("low", true);
    expect(result.goldDelta).toBe(10);
    expect(result.isCorrect).toBe(true);
  });

  it("wrong low wager loses the bet", () => {
    const result = calculateWagerResult("low", false);
    expect(result.goldDelta).toBe(-10);
  });

  it("correct high wager doubles the bet", () => {
    const result = calculateWagerResult("high", true);
    expect(result.goldDelta).toBe(25);
  });

  it("wrong high wager loses the bet", () => {
    const result = calculateWagerResult("high", false);
    expect(result.goldDelta).toBe(-25);
  });

  it("correct all-in wager doubles the bet", () => {
    const result = calculateWagerResult("all_in", true, 100);
    expect(result.goldDelta).toBe(50);
  });

  it("all-in capped at player gold when player has less than 50", () => {
    const result = calculateWagerResult("all_in", true, 30);
    expect(result.amount).toBe(30);
    expect(result.goldDelta).toBe(30);
  });

  it("all-in with zero gold returns zero delta", () => {
    const result = calculateWagerResult("all_in", true, 0);
    expect(result.amount).toBe(0);
    expect(result.goldDelta).toBe(0);
  });

  it("negative player gold is treated as zero", () => {
    const result = calculateWagerResult("low", true, -10);
    expect(result.amount).toBe(0);
    expect(result.goldDelta).toBe(0);
  });

  it("WAGER_AMOUNTS has correct values", () => {
    expect(WAGER_AMOUNTS.none).toBe(0);
    expect(WAGER_AMOUNTS.low).toBe(10);
    expect(WAGER_AMOUNTS.high).toBe(25);
    expect(WAGER_AMOUNTS.all_in).toBe(50);
  });
});

describe("summarizeWagers", () => {
  it("returns zeroes for empty results", () => {
    const summary = summarizeWagers([]);
    expect(summary.totalWagered).toBe(0);
    expect(summary.totalWon).toBe(0);
    expect(summary.totalLost).toBe(0);
    expect(summary.netGold).toBe(0);
    expect(summary.wagerCount).toBe(0);
  });

  it("ignores no-wager entries", () => {
    const results: WagerResult[] = [
      { wager: "none", amount: 0, isCorrect: true, goldDelta: 0 },
      { wager: "none", amount: 0, isCorrect: false, goldDelta: 0 },
    ];
    const summary = summarizeWagers(results);
    expect(summary.wagerCount).toBe(0);
  });

  it("sums wins and losses correctly", () => {
    const results: WagerResult[] = [
      { wager: "low", amount: 10, isCorrect: true, goldDelta: 10 },
      { wager: "high", amount: 25, isCorrect: false, goldDelta: -25 },
      { wager: "low", amount: 10, isCorrect: true, goldDelta: 10 },
    ];
    const summary = summarizeWagers(results);
    expect(summary.wagerCount).toBe(3);
    expect(summary.totalWagered).toBe(45);
    expect(summary.totalWon).toBe(20);
    expect(summary.totalLost).toBe(25);
    expect(summary.netGold).toBe(-5);
  });

  it("handles all wins", () => {
    const results: WagerResult[] = [
      { wager: "all_in", amount: 50, isCorrect: true, goldDelta: 50 },
      { wager: "high", amount: 25, isCorrect: true, goldDelta: 25 },
    ];
    const summary = summarizeWagers(results);
    expect(summary.netGold).toBe(75);
    expect(summary.totalLost).toBe(0);
  });

  it("handles all losses", () => {
    const results: WagerResult[] = [
      { wager: "low", amount: 10, isCorrect: false, goldDelta: -10 },
      { wager: "low", amount: 10, isCorrect: false, goldDelta: -10 },
    ];
    const summary = summarizeWagers(results);
    expect(summary.netGold).toBe(-20);
    expect(summary.totalWon).toBe(0);
  });
});
