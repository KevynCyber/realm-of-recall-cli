import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { ThemeProvider } from "../../src/components/app/ThemeProvider.js";
import { RandomEventScreen } from "../../src/components/screens/RandomEventScreen.js";
import type { RandomEvent, EventOutcome } from "../../src/core/combat/RandomEvents.js";

const delay = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

function themed(element: React.ReactElement) {
  return <ThemeProvider>{element}</ThemeProvider>;
}

function makeEvent(overrides: Partial<RandomEvent> = {}): RandomEvent {
  return {
    type: "treasure_room",
    title: "Treasure Room",
    description: "You discover a hidden chamber filled with glittering gold!",
    choices: [
      { label: "Collect carefully", description: "Gain a moderate amount of gold safely" },
      { label: "Grab everything", description: "Gain more gold but risk a trap" },
    ],
    ...overrides,
  };
}

describe("RandomEventScreen", () => {
  it("renders event title and description", () => {
    const event = makeEvent({
      title: "Mysterious Shrine",
      description: "An ancient shrine pulses with arcane energy.",
    });
    const { lastFrame } = render(
      themed(
        <RandomEventScreen
          event={event}
          playerLevel={5}
          playerMaxHp={100}
          onComplete={vi.fn()}
        />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("Mysterious Shrine");
    expect(frame).toContain("An ancient shrine pulses with arcane energy.");
  });

  it("renders choice buttons", () => {
    const event = makeEvent({
      choices: [
        { label: "Pray for strength", description: "Sacrifice HP to gain XP" },
        { label: "Meditate", description: "Gain Wisdom XP peacefully" },
      ],
    });
    const { lastFrame } = render(
      themed(
        <RandomEventScreen
          event={event}
          playerLevel={5}
          playerMaxHp={100}
          onComplete={vi.fn()}
        />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("[1] Pray for strength");
    expect(frame).toContain("[2] Meditate");
    expect(frame).toContain("Sacrifice HP to gain XP");
    expect(frame).toContain("Gain Wisdom XP peacefully");
  });

  it("shows outcome when choice 1 is made", async () => {
    const event = makeEvent();
    const onComplete = vi.fn();
    const { stdin, lastFrame } = render(
      themed(
        <RandomEventScreen
          event={event}
          playerLevel={5}
          playerMaxHp={100}
          onComplete={onComplete}
        />,
      ),
    );
    await delay();
    stdin.write("1");
    await delay();
    const frame = lastFrame();
    expect(frame).toContain("EVENT OUTCOME");
    expect(frame).toContain("Press Enter to continue...");
  });

  it("shows outcome when choice 2 is made", async () => {
    const event = makeEvent();
    const onComplete = vi.fn();
    const { stdin, lastFrame } = render(
      themed(
        <RandomEventScreen
          event={event}
          playerLevel={5}
          playerMaxHp={100}
          onComplete={onComplete}
        />,
      ),
    );
    await delay();
    stdin.write("2");
    await delay();
    const frame = lastFrame();
    expect(frame).toContain("EVENT OUTCOME");
    expect(frame).toContain("Press Enter to continue...");
  });

  it("calls onComplete when Enter is pressed after outcome", async () => {
    const event = makeEvent();
    const onComplete = vi.fn();
    const { stdin } = render(
      themed(
        <RandomEventScreen
          event={event}
          playerLevel={5}
          playerMaxHp={100}
          onComplete={onComplete}
        />,
      ),
    );
    await delay();
    stdin.write("1"); // Make a choice first
    await delay();
    stdin.write("\r"); // Press Enter to continue
    await delay();
    expect(onComplete).toHaveBeenCalledOnce();
    // Verify the outcome object was passed
    const outcome = onComplete.mock.calls[0][0] as EventOutcome;
    expect(outcome).toHaveProperty("description");
    expect(outcome).toHaveProperty("goldChange");
    expect(outcome).toHaveProperty("hpChange");
    expect(outcome).toHaveProperty("xpChange");
  });

  it("does not call onComplete before a choice is made", async () => {
    const event = makeEvent();
    const onComplete = vi.fn();
    const { stdin } = render(
      themed(
        <RandomEventScreen
          event={event}
          playerLevel={5}
          playerMaxHp={100}
          onComplete={onComplete}
        />,
      ),
    );
    await delay();
    stdin.write("\r"); // Press Enter without choosing
    await delay();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("renders RANDOM EVENT header in choice phase", () => {
    const event = makeEvent();
    const { lastFrame } = render(
      themed(
        <RandomEventScreen
          event={event}
          playerLevel={5}
          playerMaxHp={100}
          onComplete={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("RANDOM EVENT");
  });

  it("displays gold change in the outcome", async () => {
    // Use treasure_room choice 0 which always gives gold
    const event = makeEvent({ type: "treasure_room" });
    const { stdin, lastFrame } = render(
      themed(
        <RandomEventScreen
          event={event}
          playerLevel={5}
          playerMaxHp={100}
          onComplete={vi.fn()}
        />,
      ),
    );
    await delay();
    stdin.write("1"); // Collect carefully — guaranteed gold, no damage
    await delay();
    const frame = lastFrame();
    expect(frame).toContain("Gold");
  });

  it("displays outcome description text", async () => {
    // rest_camp choice 0 always says "You rest peacefully by the fire."
    const event = makeEvent({
      type: "rest_camp",
      title: "Rest Camp",
      description: "A safe campfire.",
      choices: [
        { label: "Rest and heal", description: "Recover HP" },
        { label: "Train", description: "Gain XP" },
      ],
    });
    const { stdin, lastFrame } = render(
      themed(
        <RandomEventScreen
          event={event}
          playerLevel={5}
          playerMaxHp={100}
          onComplete={vi.fn()}
        />,
      ),
    );
    await delay();
    stdin.write("1");
    await delay();
    const frame = lastFrame();
    expect(frame).toContain("You rest peacefully by the fire.");
    expect(frame).toContain("HP");
  });
});
