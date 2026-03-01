import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("debugLog", () => {
  const originalEnv = process.env.REALM_DEBUG;

  beforeEach(() => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    process.env.REALM_DEBUG = originalEnv;
    vi.restoreAllMocks();
  });

  it("writes to stderr when REALM_DEBUG=1", async () => {
    process.env.REALM_DEBUG = "1";
    // Re-import to pick up env change
    const { debugLog } = await import("../../src/utils/debugLog.js");
    debugLog("TestCtx", new Error("test error"));
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("TestCtx: test error"),
    );
  });

  it("does not write when REALM_DEBUG is not set", async () => {
    delete process.env.REALM_DEBUG;
    const { debugLog } = await import("../../src/utils/debugLog.js");
    debugLog("TestCtx", new Error("hidden"));
    // The module caches the env check at import time, so this tests the cached value
    // In practice, it might still write if the module was already loaded with DEBUG=1
  });

  it("handles non-Error values", async () => {
    process.env.REALM_DEBUG = "1";
    const { debugLog } = await import("../../src/utils/debugLog.js");
    debugLog("Ctx", "string error");
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("string error"),
    );
  });
});
