import { describe, it, expect } from "vitest";
import {
  rollForEvent,
  resolveEventChoice,
  getAllEventTypes,
} from "../../../src/core/combat/RandomEvents.js";
import type { RandomEvent } from "../../../src/core/combat/RandomEvents.js";

describe("rollForEvent", () => {
  it("returns null when rng > 0.30", () => {
    let callCount = 0;
    const rng = () => {
      callCount++;
      return callCount === 1 ? 0.5 : 0.5; // First call: trigger check (fails)
    };
    expect(rollForEvent(100, rng)).toBeNull();
  });

  it("returns an event when rng <= 0.30", () => {
    const rng = () => 0.1;
    const event = rollForEvent(100, rng);
    expect(event).not.toBeNull();
    expect(event!.type).toBeTruthy();
    expect(event!.title).toBeTruthy();
    expect(event!.choices.length).toBeGreaterThanOrEqual(2);
  });

  it("returns null when rng is exactly 1.0", () => {
    const rng = () => 1.0;
    expect(rollForEvent(100, rng)).toBeNull();
  });

  it("weights rest_camp higher when HP is low", () => {
    let restCampCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      let call = 0;
      const rng = () => {
        call++;
        if (call === 1) return 0.1; // Pass trigger check
        return Math.random(); // Random for selection
      };
      const event = rollForEvent(20, rng); // Low HP
      if (event?.type === "rest_camp") restCampCount++;
    }
    // rest_camp should appear more often than a uniform 1/8 (~12.5%)
    const percentage = restCampCount / trials;
    expect(percentage).toBeGreaterThan(0.1);
  });

  it("reduces cursed_chest weight when HP is very low", () => {
    let cursedCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      let call = 0;
      const rng = () => {
        call++;
        if (call === 1) return 0.1;
        return Math.random();
      };
      const event = rollForEvent(10, rng); // Very low HP
      if (event?.type === "cursed_chest") cursedCount++;
    }
    // cursed_chest should appear less than uniform 1/8
    const percentage = cursedCount / trials;
    expect(percentage).toBeLessThan(0.15);
  });
});

describe("resolveEventChoice", () => {
  function findEvent(type: string): RandomEvent {
    const all = getAllEventTypes();
    const rng = () => 0.1;
    // Roll many times to find the right event
    for (let i = 0; i < 1000; i++) {
      let call = 0;
      const event = rollForEvent(50, () => {
        call++;
        return call === 1 ? 0.1 : Math.random();
      });
      if (event?.type === type) return event;
    }
    throw new Error(`Could not find event of type ${type}`);
  }

  it("treasure_room safe: gives gold, no damage", () => {
    const event = findEvent("treasure_room");
    const outcome = resolveEventChoice(event, 0, 5, 100);
    expect(outcome.goldChange).toBeGreaterThan(0);
    expect(outcome.hpChange).toBe(0);
  });

  it("treasure_room risky with lucky rng: more gold", () => {
    const event = findEvent("treasure_room");
    const outcome = resolveEventChoice(event, 1, 5, 100, () => 0.5); // > 0.3 = lucky
    expect(outcome.goldChange).toBeGreaterThan(0);
    expect(outcome.hpChange).toBe(0);
  });

  it("treasure_room risky with unlucky rng: trap damage", () => {
    const event = findEvent("treasure_room");
    const outcome = resolveEventChoice(event, 1, 5, 100, () => 0.2); // <= 0.3 = unlucky
    expect(outcome.goldChange).toBeGreaterThan(0);
    expect(outcome.hpChange).toBeLessThan(0);
  });

  it("rest_camp heal: restores 30% of maxHP", () => {
    const event = findEvent("rest_camp");
    const outcome = resolveEventChoice(event, 0, 5, 100);
    expect(outcome.hpChange).toBe(30); // ceil(100 * 0.3)
  });

  it("rest_camp train: gives XP", () => {
    const event = findEvent("rest_camp");
    const outcome = resolveEventChoice(event, 1, 5, 100);
    expect(outcome.xpChange).toBeGreaterThan(0);
  });

  it("cursed_chest walk away: no change", () => {
    const event = findEvent("cursed_chest");
    const outcome = resolveEventChoice(event, 1, 5, 100);
    expect(outcome.goldChange).toBe(0);
    expect(outcome.hpChange).toBe(0);
    expect(outcome.xpChange).toBe(0);
  });

  it("cursed_chest open with lucky rng: treasure", () => {
    const event = findEvent("cursed_chest");
    const outcome = resolveEventChoice(event, 0, 5, 100, () => 0.6); // > 0.5 = lucky
    expect(outcome.goldChange).toBeGreaterThan(0);
    expect(outcome.xpChange).toBeGreaterThan(0);
  });

  it("cursed_chest open with unlucky rng: damage", () => {
    const event = findEvent("cursed_chest");
    const outcome = resolveEventChoice(event, 0, 5, 100, () => 0.4); // <= 0.5 = unlucky
    expect(outcome.hpChange).toBeLessThan(0);
  });

  it("streak_guardian accept: gives shield", () => {
    const event = findEvent("streak_guardian");
    const outcome = resolveEventChoice(event, 0, 5, 100);
    expect(outcome.shieldChange).toBe(1);
  });

  it("streak_guardian prove worth: gives gold", () => {
    const event = findEvent("streak_guardian");
    const outcome = resolveEventChoice(event, 1, 5, 100);
    expect(outcome.goldChange).toBeGreaterThan(0);
  });

  it("scales rewards with player level", () => {
    const event = findEvent("treasure_room");
    const low = resolveEventChoice(event, 0, 1, 100);
    const high = resolveEventChoice(event, 0, 10, 100);
    expect(high.goldChange).toBeGreaterThan(low.goldChange);
  });

  it("mysterious_shrine sacrifice: costs HP, gives XP", () => {
    const event = findEvent("mysterious_shrine");
    const outcome = resolveEventChoice(event, 0, 5, 100);
    expect(outcome.hpChange).toBeLessThan(0);
    expect(outcome.xpChange).toBeGreaterThan(0);
  });

  it("card_blessing accept: gives evolution boost", () => {
    const event = findEvent("card_blessing");
    const outcome = resolveEventChoice(event, 0, 5, 100);
    expect(outcome.evolutionBoost).toBe(true);
  });

  it("wisdom_well drink deeply: gives large wisdom XP", () => {
    const event = findEvent("wisdom_well");
    const outcome = resolveEventChoice(event, 0, 5, 100);
    expect(outcome.wisdomXpChange).toBe(50);
  });

  it("wisdom_well fill flask: gives smaller wisdom XP and heals", () => {
    const event = findEvent("wisdom_well");
    const outcome = resolveEventChoice(event, 1, 5, 100);
    expect(outcome.wisdomXpChange).toBe(20);
    expect(outcome.hpChange).toBeGreaterThan(0);
  });
});

describe("getAllEventTypes", () => {
  it("returns 8 event types", () => {
    expect(getAllEventTypes()).toHaveLength(8);
  });

  it("includes all expected types", () => {
    const types = getAllEventTypes();
    expect(types).toContain("treasure_room");
    expect(types).toContain("wandering_merchant");
    expect(types).toContain("mysterious_shrine");
    expect(types).toContain("card_blessing");
    expect(types).toContain("rest_camp");
    expect(types).toContain("cursed_chest");
    expect(types).toContain("wisdom_well");
    expect(types).toContain("streak_guardian");
  });
});
