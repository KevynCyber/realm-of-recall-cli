import { describe, it, expect } from "vitest";
import {
  shouldTriggerOracleTrial,
  createOracleTrial,
  scoreOracleTrial,
  TRIAL_SESSION_INTERVAL,
  TRIAL_RANDOM_CHANCE,
  MIN_SESSIONS_SINCE_TRIAL,
  SEER_THRESHOLD,
  ADEPT_THRESHOLD,
  SEER_MULTIPLIER,
  ADEPT_MULTIPLIER,
  BASE_TRIAL_WXP,
  type OracleTrialSetup,
  type OracleTrialResult,
} from "../../../src/core/combat/OracleTrial.js";

describe("shouldTriggerOracleTrial", () => {
  describe("interval-based triggering", () => {
    it("triggers at session 5", () => {
      expect(shouldTriggerOracleTrial(5, 0)).toBe(true);
    });

    it("triggers at session 10", () => {
      expect(shouldTriggerOracleTrial(10, 0)).toBe(true);
    });

    it("triggers at session 15", () => {
      expect(shouldTriggerOracleTrial(15, 0)).toBe(true);
    });

    it("does not trigger at session 0", () => {
      const alwaysLowRng = () => 0;
      expect(shouldTriggerOracleTrial(0, 0, alwaysLowRng)).toBe(false);
    });

    it("does not trigger at non-interval sessions without random chance", () => {
      const neverRng = () => 1;
      expect(shouldTriggerOracleTrial(3, 0, neverRng)).toBe(false);
      expect(shouldTriggerOracleTrial(7, 0, neverRng)).toBe(false);
      expect(shouldTriggerOracleTrial(12, 10, neverRng)).toBe(false);
    });
  });

  describe("random triggering", () => {
    it("triggers randomly when rng < TRIAL_RANDOM_CHANCE and enough sessions elapsed", () => {
      const lowRng = () => 0.05; // below 0.10
      expect(shouldTriggerOracleTrial(4, 0, lowRng)).toBe(true);
    });

    it("does not trigger randomly when rng >= TRIAL_RANDOM_CHANCE", () => {
      const highRng = () => 0.5;
      expect(shouldTriggerOracleTrial(4, 0, highRng)).toBe(false);
    });

    it("does not trigger randomly if fewer than MIN_SESSIONS_SINCE_TRIAL since last trial", () => {
      const lowRng = () => 0.01;
      // 2 sessions since last trial (session 1), which is < 3
      expect(shouldTriggerOracleTrial(3, 1, lowRng)).toBe(false);
      // 1 session since last trial
      expect(shouldTriggerOracleTrial(4, 3, lowRng)).toBe(false);
    });

    it("triggers randomly at exactly MIN_SESSIONS_SINCE_TRIAL gap", () => {
      const lowRng = () => 0.05;
      // 3 sessions since last trial (session 0)
      expect(shouldTriggerOracleTrial(3, 0, lowRng)).toBe(true);
    });

    it("uses boundary value for TRIAL_RANDOM_CHANCE", () => {
      // Exactly at the boundary should NOT trigger (< not <=)
      const exactRng = () => 0.10;
      expect(shouldTriggerOracleTrial(4, 0, exactRng)).toBe(false);

      // Just below boundary should trigger
      const justBelowRng = () => 0.0999;
      expect(shouldTriggerOracleTrial(4, 0, justBelowRng)).toBe(true);
    });
  });

  describe("same-session guard", () => {
    it("never triggers if lastTrialSession equals sessionsCompleted", () => {
      expect(shouldTriggerOracleTrial(5, 5)).toBe(false);
    });

    it("never triggers randomly if already done this session", () => {
      const lowRng = () => 0.01;
      expect(shouldTriggerOracleTrial(7, 7, lowRng)).toBe(false);
    });

    it("never triggers at interval if already done this session", () => {
      expect(shouldTriggerOracleTrial(10, 10)).toBe(false);
    });
  });
});

describe("createOracleTrial", () => {
  it("returns the correct card count", () => {
    const setup = createOracleTrial(10);
    expect(setup.cardCount).toBe(10);
  });

  it("generates the correct prompt format", () => {
    const setup = createOracleTrial(10);
    expect(setup.prompt).toBe(
      "Oracle's Trial: You will review 10 cards. How many will you answer correctly?",
    );
  });

  it("includes card count in prompt for different values", () => {
    const setup = createOracleTrial(7);
    expect(setup.prompt).toContain("7 cards");
  });

  it("handles 1 card", () => {
    const setup = createOracleTrial(1);
    expect(setup.prompt).toBe(
      "Oracle's Trial: You will review 1 cards. How many will you answer correctly?",
    );
    expect(setup.cardCount).toBe(1);
  });

  it("handles 0 cards", () => {
    const setup = createOracleTrial(0);
    expect(setup.cardCount).toBe(0);
    expect(setup.prompt).toContain("0 cards");
  });
});

describe("scoreOracleTrial", () => {
  describe("seer tier (difference <= 1)", () => {
    it("exact prediction scores seer tier", () => {
      const result = scoreOracleTrial(7, 7, 10);
      expect(result.tier).toBe("seer");
      expect(result.difference).toBe(0);
      expect(result.wxpMultiplier).toBe(SEER_MULTIPLIER);
    });

    it("off by 1 (over) scores seer tier", () => {
      const result = scoreOracleTrial(8, 7, 10);
      expect(result.tier).toBe("seer");
      expect(result.difference).toBe(1);
      expect(result.wxpMultiplier).toBe(2.0);
    });

    it("off by 1 (under) scores seer tier", () => {
      const result = scoreOracleTrial(6, 7, 10);
      expect(result.tier).toBe("seer");
      expect(result.difference).toBe(1);
      expect(result.wxpMultiplier).toBe(2.0);
    });

    it("exact match shows perfect calibration message", () => {
      const result = scoreOracleTrial(5, 5, 10);
      expect(result.message).toContain("Perfect calibration");
    });

    it("off by 1 shows near-perfect message", () => {
      const result = scoreOracleTrial(4, 5, 10);
      expect(result.message).toContain("Near-perfect");
    });
  });

  describe("adept tier (difference <= 2)", () => {
    it("off by 2 scores adept tier", () => {
      const result = scoreOracleTrial(5, 7, 10);
      expect(result.tier).toBe("adept");
      expect(result.difference).toBe(2);
      expect(result.wxpMultiplier).toBe(ADEPT_MULTIPLIER);
    });

    it("off by 2 (over) scores adept tier", () => {
      const result = scoreOracleTrial(9, 7, 10);
      expect(result.tier).toBe("adept");
      expect(result.difference).toBe(2);
      expect(result.wxpMultiplier).toBe(1.5);
    });
  });

  describe("novice tier (difference > 2)", () => {
    it("off by 3 scores novice tier", () => {
      const result = scoreOracleTrial(4, 7, 10);
      expect(result.tier).toBe("novice");
      expect(result.difference).toBe(3);
      expect(result.wxpMultiplier).toBe(1.0);
    });

    it("off by 5 scores novice tier", () => {
      const result = scoreOracleTrial(2, 7, 10);
      expect(result.tier).toBe("novice");
      expect(result.difference).toBe(5);
      expect(result.wxpMultiplier).toBe(1.0);
    });

    it("wildly wrong prediction scores novice tier", () => {
      const result = scoreOracleTrial(0, 10, 10);
      expect(result.tier).toBe("novice");
      expect(result.difference).toBe(10);
      expect(result.wxpMultiplier).toBe(1.0);
    });

    it("novice message encourages self-reflection", () => {
      const result = scoreOracleTrial(0, 10, 10);
      expect(result.message).toContain("self-reflection");
    });
  });

  describe("edge cases", () => {
    it("predicted 0 and actual 0 is seer", () => {
      const result = scoreOracleTrial(0, 0, 10);
      expect(result.tier).toBe("seer");
      expect(result.difference).toBe(0);
    });

    it("predicted all correct and got all correct", () => {
      const result = scoreOracleTrial(10, 10, 10);
      expect(result.tier).toBe("seer");
      expect(result.difference).toBe(0);
      expect(result.wxpMultiplier).toBe(2.0);
    });

    it("predicted all correct but got none correct", () => {
      const result = scoreOracleTrial(10, 0, 10);
      expect(result.tier).toBe("novice");
      expect(result.difference).toBe(10);
    });

    it("predicted 0 but got all correct", () => {
      const result = scoreOracleTrial(0, 10, 10);
      expect(result.tier).toBe("novice");
      expect(result.difference).toBe(10);
    });

    it("result always includes predicted and actual values", () => {
      const result = scoreOracleTrial(3, 5, 10);
      expect(result.predicted).toBe(3);
      expect(result.actual).toBe(5);
    });
  });

  describe("WXP multipliers", () => {
    it("seer gets 2.0x multiplier", () => {
      expect(scoreOracleTrial(5, 5, 10).wxpMultiplier).toBe(2.0);
    });

    it("adept gets 1.5x multiplier", () => {
      expect(scoreOracleTrial(5, 7, 10).wxpMultiplier).toBe(1.5);
    });

    it("novice gets 1.0x multiplier (no bonus)", () => {
      expect(scoreOracleTrial(5, 9, 10).wxpMultiplier).toBe(1.0);
    });
  });
});

describe("constants", () => {
  it("TRIAL_SESSION_INTERVAL is 5", () => {
    expect(TRIAL_SESSION_INTERVAL).toBe(5);
  });

  it("TRIAL_RANDOM_CHANCE is 0.10", () => {
    expect(TRIAL_RANDOM_CHANCE).toBe(0.10);
  });

  it("MIN_SESSIONS_SINCE_TRIAL is 3", () => {
    expect(MIN_SESSIONS_SINCE_TRIAL).toBe(3);
  });

  it("SEER_THRESHOLD is 1", () => {
    expect(SEER_THRESHOLD).toBe(1);
  });

  it("ADEPT_THRESHOLD is 2", () => {
    expect(ADEPT_THRESHOLD).toBe(2);
  });

  it("SEER_MULTIPLIER is 2.0", () => {
    expect(SEER_MULTIPLIER).toBe(2.0);
  });

  it("ADEPT_MULTIPLIER is 1.5", () => {
    expect(ADEPT_MULTIPLIER).toBe(1.5);
  });

  it("BASE_TRIAL_WXP is 10", () => {
    expect(BASE_TRIAL_WXP).toBe(10);
  });
});
