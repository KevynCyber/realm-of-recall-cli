import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("TerminalTitle", () => {
  describe("with animations enabled", () => {
    let mod: typeof import("../../src/utils/TerminalTitle.js");

    beforeEach(async () => {
      vi.resetModules();
      delete process.env.REALM_NO_ANIMATION;
      mod = await import("../../src/utils/TerminalTitle.js");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("setTerminalTitle writes correct OSC escape sequence", () => {
      const writeSpy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      mod.setTerminalTitle("Realm of Recall — Hub");
      expect(writeSpy).toHaveBeenCalledWith(
        "\x1b]0;Realm of Recall — Hub\x07",
      );
    });

    it("setTerminalTitle writes correct escape for combat screen", () => {
      const writeSpy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      mod.setTerminalTitle("Realm of Recall — Combat vs Goblin");
      expect(writeSpy).toHaveBeenCalledWith(
        "\x1b]0;Realm of Recall — Combat vs Goblin\x07",
      );
    });

    it("setTerminalTitle writes correct escape for floor screen", () => {
      const writeSpy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      mod.setTerminalTitle("Realm of Recall — Floor 3");
      expect(writeSpy).toHaveBeenCalledWith(
        "\x1b]0;Realm of Recall — Floor 3\x07",
      );
    });

    it("clearTerminalTitle resets title to empty string", () => {
      const writeSpy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      mod.clearTerminalTitle();
      expect(writeSpy).toHaveBeenCalledWith("\x1b]0;\x07");
    });

    it("notifyBel writes BEL character", () => {
      const writeSpy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      mod.notifyBel();
      expect(writeSpy).toHaveBeenCalledWith("\x07");
    });
  });

  describe("with animations disabled (REALM_NO_ANIMATION=1)", () => {
    let mod: typeof import("../../src/utils/TerminalTitle.js");

    beforeEach(async () => {
      vi.resetModules();
      process.env.REALM_NO_ANIMATION = "1";
      mod = await import("../../src/utils/TerminalTitle.js");
    });

    afterEach(() => {
      delete process.env.REALM_NO_ANIMATION;
      vi.restoreAllMocks();
    });

    it("setTerminalTitle does not write when animations disabled", () => {
      const writeSpy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      mod.setTerminalTitle("Realm of Recall — Hub");
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it("clearTerminalTitle does not write when animations disabled", () => {
      const writeSpy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      mod.clearTerminalTitle();
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it("notifyBel does not write when animations disabled", () => {
      const writeSpy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      mod.notifyBel();
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });
});
