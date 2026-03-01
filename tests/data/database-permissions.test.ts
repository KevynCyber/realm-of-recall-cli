import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

describe("database directory permissions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates data directory with mode 0o700", async () => {
    const mkdirSpy = vi.spyOn(fs, "mkdirSync");
    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);

    // Use a path that won't actually exist
    const fakePath = path.join(os.tmpdir(), "ror-perm-test-" + Date.now(), "game.db");

    // We need to mock Database constructor to avoid actually creating the file
    vi.doMock("better-sqlite3", () => {
      return {
        default: vi.fn(() => ({
          pragma: vi.fn(),
          prepare: vi.fn(() => ({ all: vi.fn(() => []), run: vi.fn() })),
          exec: vi.fn(),
          close: vi.fn(),
        })),
      };
    });

    // Re-import to get fresh module with mocked dependencies
    const { getDatabase, closeDatabase } = await import("../../src/data/database.js");

    try {
      getDatabase(fakePath);
    } catch {
      // May fail due to mock limitations, but we only care about mkdirSync call
    }

    const mkdirCall = mkdirSpy.mock.calls.find(
      (call) => call[1] && typeof call[1] === "object" && "mode" in call[1],
    );
    expect(mkdirCall).toBeDefined();
    expect((mkdirCall![1] as fs.MakeDirectoryOptions).mode).toBe(0o700);
    expect((mkdirCall![1] as fs.MakeDirectoryOptions).recursive).toBe(true);

    try {
      closeDatabase();
    } catch {
      // ignore cleanup errors
    }

    // Clean up the directory if it was actually created
    const dir = path.dirname(fakePath);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
  });
});
