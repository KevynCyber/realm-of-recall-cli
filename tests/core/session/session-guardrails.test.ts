import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getBreakLevel,
  formatSessionDuration,
  getBreakMessage,
  isBreakSuppressed,
  SOFT_BREAK_THRESHOLD_MS,
  HARD_BREAK_THRESHOLD_MS,
} from "../../../src/core/session/SessionGuardrails.js";

describe("SessionGuardrails", () => {
  describe("getBreakLevel", () => {
    it("returns 'none' when session just started", () => {
      const now = Date.now();
      expect(getBreakLevel(now, now)).toBe("none");
    });

    it("returns 'none' at 14 minutes", () => {
      const start = 0;
      const now = 14 * 60 * 1000;
      expect(getBreakLevel(start, now)).toBe("none");
    });

    it("returns 'soft' at exactly 15 minutes", () => {
      const start = 0;
      const now = SOFT_BREAK_THRESHOLD_MS;
      expect(getBreakLevel(start, now)).toBe("soft");
    });

    it("returns 'soft' at 20 minutes", () => {
      const start = 0;
      const now = 20 * 60 * 1000;
      expect(getBreakLevel(start, now)).toBe("soft");
    });

    it("returns 'hard' at exactly 25 minutes", () => {
      const start = 0;
      const now = HARD_BREAK_THRESHOLD_MS;
      expect(getBreakLevel(start, now)).toBe("hard");
    });

    it("returns 'hard' at 30 minutes", () => {
      const start = 0;
      const now = 30 * 60 * 1000;
      expect(getBreakLevel(start, now)).toBe("hard");
    });

    it("works with arbitrary start times", () => {
      const start = 1000000;
      expect(getBreakLevel(start, start + 10 * 60 * 1000)).toBe("none");
      expect(getBreakLevel(start, start + 15 * 60 * 1000)).toBe("soft");
      expect(getBreakLevel(start, start + 25 * 60 * 1000)).toBe("hard");
    });
  });

  describe("formatSessionDuration", () => {
    it("formats seconds only when under a minute", () => {
      expect(formatSessionDuration(45_000)).toBe("45s");
    });

    it("formats minutes and seconds", () => {
      expect(formatSessionDuration(15 * 60 * 1000 + 30_000)).toBe("15m 30s");
    });

    it("formats zero seconds", () => {
      expect(formatSessionDuration(0)).toBe("0s");
    });

    it("formats exact minutes with zero seconds", () => {
      expect(formatSessionDuration(5 * 60 * 1000)).toBe("5m 0s");
    });

    it("formats 25 minutes correctly", () => {
      expect(formatSessionDuration(25 * 60 * 1000)).toBe("25m 0s");
    });
  });

  describe("getBreakMessage", () => {
    it("returns empty string for 'none'", () => {
      expect(getBreakMessage("none")).toBe("");
    });

    it("returns subtle message for 'soft'", () => {
      const message = getBreakMessage("soft");
      expect(message).toContain("break");
      expect(message.length).toBeGreaterThan(0);
    });

    it("returns prominent message for 'hard'", () => {
      const message = getBreakMessage("hard");
      expect(message).toContain("break");
      expect(message.length).toBeGreaterThan(0);
    });

    it("soft and hard messages are different", () => {
      expect(getBreakMessage("soft")).not.toBe(getBreakMessage("hard"));
    });
  });

  describe("isBreakSuppressed", () => {
    const originalEnv = process.env.REALM_NO_ANIMATION;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.REALM_NO_ANIMATION;
      } else {
        process.env.REALM_NO_ANIMATION = originalEnv;
      }
    });

    it("returns false when env var is not set", () => {
      delete process.env.REALM_NO_ANIMATION;
      expect(isBreakSuppressed()).toBe(false);
    });

    it("returns true when env var is '1'", () => {
      process.env.REALM_NO_ANIMATION = "1";
      expect(isBreakSuppressed()).toBe(true);
    });

    it("returns true when env var is 'true'", () => {
      process.env.REALM_NO_ANIMATION = "true";
      expect(isBreakSuppressed()).toBe(true);
    });

    it("returns false when env var is '0'", () => {
      process.env.REALM_NO_ANIMATION = "0";
      expect(isBreakSuppressed()).toBe(false);
    });
  });

  describe("threshold constants", () => {
    it("soft threshold is 15 minutes", () => {
      expect(SOFT_BREAK_THRESHOLD_MS).toBe(15 * 60 * 1000);
    });

    it("hard threshold is 25 minutes", () => {
      expect(HARD_BREAK_THRESHOLD_MS).toBe(25 * 60 * 1000);
    });

    it("hard threshold is greater than soft threshold", () => {
      expect(HARD_BREAK_THRESHOLD_MS).toBeGreaterThan(SOFT_BREAK_THRESHOLD_MS);
    });
  });
});
