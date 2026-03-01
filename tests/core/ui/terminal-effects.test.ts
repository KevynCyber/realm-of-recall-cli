import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test the module with different env var states.
// Since ANIMATIONS_DISABLED is captured at module load time,
// we use vi.importActual / dynamic imports and resetModules.

describe("TerminalEffects", () => {
  // Default tests (without REALM_NO_ANIMATION set)
  describe("with animations enabled", () => {
    let mod: typeof import("../../../src/core/ui/TerminalEffects.js");

    beforeEach(async () => {
      vi.resetModules();
      delete process.env.REALM_NO_ANIMATION;
      mod = await import("../../../src/core/ui/TerminalEffects.js");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("playBel writes BEL character to stdout", () => {
      const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      mod.playBel();
      expect(writeSpy).toHaveBeenCalledWith("\x07");
    });

    it("LEVEL_UP_ART is an array of strings", () => {
      expect(Array.isArray(mod.LEVEL_UP_ART)).toBe(true);
      expect(mod.LEVEL_UP_ART.length).toBeGreaterThan(0);
      for (const line of mod.LEVEL_UP_ART) {
        expect(typeof line).toBe("string");
      }
    });

    it("revealText produces frames for each character", () => {
      const result = mod.revealText("hello");
      expect(result.frames).toHaveLength(5);
      expect(result.frames[0]).toBe("h");
      expect(result.frames[1]).toBe("he");
      expect(result.frames[2]).toBe("hel");
      expect(result.frames[3]).toBe("hell");
      expect(result.frames[4]).toBe("hello");
    });

    it("revealText calculates correct totalMs", () => {
      const result = mod.revealText("abc", 50);
      expect(result.frames).toHaveLength(3);
      expect(result.totalMs).toBe(150); // 3 frames * 50ms
    });

    it("revealText uses default 30ms delay", () => {
      const result = mod.revealText("ab");
      expect(result.totalMs).toBe(60); // 2 frames * 30ms
    });

    it("revealText handles empty string", () => {
      const result = mod.revealText("");
      expect(result.frames).toHaveLength(0);
      expect(result.totalMs).toBe(0);
    });

    it("animationsEnabled returns true", () => {
      expect(mod.animationsEnabled()).toBe(true);
    });
  });

  describe("with animations disabled (REALM_NO_ANIMATION=1)", () => {
    let mod: typeof import("../../../src/core/ui/TerminalEffects.js");

    beforeEach(async () => {
      vi.resetModules();
      process.env.REALM_NO_ANIMATION = "1";
      mod = await import("../../../src/core/ui/TerminalEffects.js");
    });

    afterEach(() => {
      delete process.env.REALM_NO_ANIMATION;
      vi.restoreAllMocks();
    });

    it("playBel does not write to stdout when animations disabled", () => {
      const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      mod.playBel();
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it("revealText returns single frame with full text when animations disabled", () => {
      const result = mod.revealText("hello world");
      expect(result.frames).toHaveLength(1);
      expect(result.frames[0]).toBe("hello world");
      expect(result.totalMs).toBe(0);
    });

    it("animationsEnabled returns false", () => {
      expect(mod.animationsEnabled()).toBe(false);
    });
  });

  describe("ACHIEVEMENT_ART", () => {
    let mod: typeof import("../../../src/core/ui/TerminalEffects.js");

    beforeEach(async () => {
      vi.resetModules();
      delete process.env.REALM_NO_ANIMATION;
      mod = await import("../../../src/core/ui/TerminalEffects.js");
    });

    it("is an array of strings", () => {
      expect(Array.isArray(mod.ACHIEVEMENT_ART)).toBe(true);
      expect(mod.ACHIEVEMENT_ART.length).toBeGreaterThan(0);
      for (const line of mod.ACHIEVEMENT_ART) {
        expect(typeof line).toBe("string");
      }
    });
  });
});
