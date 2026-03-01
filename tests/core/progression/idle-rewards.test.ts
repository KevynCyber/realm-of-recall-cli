import { describe, it, expect } from "vitest";
import { calculateIdleRewards } from "../../../src/core/progression/IdleRewards.js";

// ---------------------------------------------------------------------------
// calculateIdleRewards — time thresholds
// ---------------------------------------------------------------------------
describe("calculateIdleRewards — time thresholds", () => {
  it("returns null when lastLoginAt is null", () => {
    const result = calculateIdleRewards(null, new Date(), 50, 100);
    expect(result).toBeNull();
  });

  it("returns null when less than 1 hour has elapsed", () => {
    const now = new Date("2026-02-28T12:00:00Z");
    const lastLogin = new Date("2026-02-28T11:30:00Z").toISOString(); // 30 min ago
    const result = calculateIdleRewards(lastLogin, now, 50, 100);
    expect(result).toBeNull();
  });

  it("returns null when exactly 59 minutes have elapsed", () => {
    const now = new Date("2026-02-28T12:00:00Z");
    const lastLogin = new Date("2026-02-28T11:01:00Z").toISOString(); // 59 min ago
    const result = calculateIdleRewards(lastLogin, now, 50, 100);
    expect(result).toBeNull();
  });

  it("returns rewards when exactly 1 hour has elapsed", () => {
    const now = new Date("2026-02-28T12:00:00Z");
    const lastLogin = new Date("2026-02-28T11:00:00Z").toISOString(); // 1 hour ago
    const result = calculateIdleRewards(lastLogin, now, 50, 100);
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculateIdleRewards — gold calculation
// ---------------------------------------------------------------------------
describe("calculateIdleRewards — gold calculation", () => {
  it("awards 30 gold per hour", () => {
    const now = new Date("2026-02-28T14:00:00Z");
    const lastLogin = new Date("2026-02-28T12:00:00Z").toISOString(); // 2 hours
    const result = calculateIdleRewards(lastLogin, now, 100, 100);
    expect(result).not.toBeNull();
    expect(result!.gold).toBe(60); // 2 * 30
  });

  it("awards fractional hours (floors the result)", () => {
    const now = new Date("2026-02-28T13:30:00Z");
    const lastLogin = new Date("2026-02-28T12:00:00Z").toISOString(); // 1.5 hours
    const result = calculateIdleRewards(lastLogin, now, 100, 100);
    expect(result).not.toBeNull();
    expect(result!.gold).toBe(45); // floor(1.5 * 30)
  });

  it("caps gold at 240 (8 hours)", () => {
    const now = new Date("2026-02-28T22:00:00Z");
    const lastLogin = new Date("2026-02-28T12:00:00Z").toISOString(); // 10 hours
    const result = calculateIdleRewards(lastLogin, now, 100, 100);
    expect(result).not.toBeNull();
    expect(result!.gold).toBe(240); // capped at 8 * 30
  });

  it("caps gold at 240 even for very long absences", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    const lastLogin = new Date("2026-02-28T12:00:00Z").toISOString(); // 24 hours
    const result = calculateIdleRewards(lastLogin, now, 100, 100);
    expect(result).not.toBeNull();
    expect(result!.gold).toBe(240);
  });

  it("awards exactly 240 gold at exactly 8 hours", () => {
    const now = new Date("2026-02-28T20:00:00Z");
    const lastLogin = new Date("2026-02-28T12:00:00Z").toISOString(); // 8 hours
    const result = calculateIdleRewards(lastLogin, now, 100, 100);
    expect(result).not.toBeNull();
    expect(result!.gold).toBe(240);
  });
});

// ---------------------------------------------------------------------------
// calculateIdleRewards — HP recovery
// ---------------------------------------------------------------------------
describe("calculateIdleRewards — HP recovery", () => {
  it("recovers 10% maxHp per hour", () => {
    const now = new Date("2026-02-28T15:00:00Z");
    const lastLogin = new Date("2026-02-28T12:00:00Z").toISOString(); // 3 hours
    // maxHp=100, currentHp=50, so 3 hours * 10% * 100 = 30 HP
    const result = calculateIdleRewards(lastLogin, now, 50, 100);
    expect(result).not.toBeNull();
    expect(result!.hpRecovered).toBe(30);
  });

  it("does not recover beyond maxHp", () => {
    const now = new Date("2026-02-28T22:00:00Z");
    const lastLogin = new Date("2026-02-28T12:00:00Z").toISOString(); // 10 hours
    // maxHp=100, currentHp=90, 10 HP missing
    // Raw recovery = floor(8 * 0.1 * 100) = 80, but only 10 HP missing
    const result = calculateIdleRewards(lastLogin, now, 90, 100);
    expect(result).not.toBeNull();
    expect(result!.hpRecovered).toBe(10);
  });

  it("recovers 0 HP when already at full HP", () => {
    const now = new Date("2026-02-28T15:00:00Z");
    const lastLogin = new Date("2026-02-28T12:00:00Z").toISOString(); // 3 hours
    const result = calculateIdleRewards(lastLogin, now, 100, 100);
    expect(result).not.toBeNull();
    expect(result!.hpRecovered).toBe(0);
  });

  it("scales HP recovery with maxHp", () => {
    const now = new Date("2026-02-28T14:00:00Z");
    const lastLogin = new Date("2026-02-28T12:00:00Z").toISOString(); // 2 hours
    // maxHp=200, currentHp=100, so 2 * 10% * 200 = 40 HP
    const result = calculateIdleRewards(lastLogin, now, 100, 200);
    expect(result).not.toBeNull();
    expect(result!.hpRecovered).toBe(40);
  });

  it("caps HP recovery to what is missing even for long absences", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    const lastLogin = new Date("2026-02-28T12:00:00Z").toISOString(); // 24 hours
    // maxHp=150, currentHp=140, only 10 HP missing
    const result = calculateIdleRewards(lastLogin, now, 140, 150);
    expect(result).not.toBeNull();
    expect(result!.hpRecovered).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// calculateIdleRewards — hoursAway
// ---------------------------------------------------------------------------
describe("calculateIdleRewards — hoursAway", () => {
  it("reports truncated hours away", () => {
    const now = new Date("2026-02-28T15:30:00Z");
    const lastLogin = new Date("2026-02-28T12:00:00Z").toISOString(); // 3.5 hours
    const result = calculateIdleRewards(lastLogin, now, 50, 100);
    expect(result).not.toBeNull();
    expect(result!.hoursAway).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// calculateIdleRewards — combined rewards
// ---------------------------------------------------------------------------
describe("calculateIdleRewards — combined rewards", () => {
  it("awards both gold and HP for a standard away period", () => {
    const now = new Date("2026-02-28T18:00:00Z");
    const lastLogin = new Date("2026-02-28T12:00:00Z").toISOString(); // 6 hours
    // maxHp=100, currentHp=40
    // Gold: 6 * 30 = 180
    // HP: floor(6 * 0.1 * 100) = 60, but only 60 missing => 60
    const result = calculateIdleRewards(lastLogin, now, 40, 100);
    expect(result).not.toBeNull();
    expect(result!.gold).toBe(180);
    expect(result!.hpRecovered).toBe(60);
    expect(result!.hoursAway).toBe(6);
  });
});
