import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { ThemeProvider } from "../../src/components/app/ThemeProvider.js";
import { TitleScreen } from "../../src/components/screens/TitleScreen.js";
import { PlayerClass } from "../../src/types/index.js";

const delay = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

function themed(element: React.ReactElement) {
  return <ThemeProvider>{element}</ThemeProvider>;
}

describe("TitleScreen", () => {
  it("renders the title ASCII art", () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    // ASCII art renders the title via individual letter outlines, not "REALM" as text
    expect(lastFrame()).toContain("____");
  });

  it("renders tagline", () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    expect(lastFrame()).toContain("Learn through combat");
  });

  it("starts in name entry phase", () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    expect(lastFrame()).toContain("Enter your name");
  });

  it("transitions to class selection after name submit", async () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame, stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    // TextInput starts with "Hero" as default, submit it with Enter
    stdin.write("\r");
    await delay();
    const frame = lastFrame();
    expect(frame).toContain("Choose your class");
    expect(frame).toContain("Hero"); // shows the entered name
  });

  it("renders all three class options in class phase", async () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame, stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    stdin.write("\r"); // submit name
    await delay();
    const frame = lastFrame();
    expect(frame).toContain("Scholar");
    expect(frame).toContain("Warrior");
    expect(frame).toContain("Rogue");
  });

  it("renders class taglines", async () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame, stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    stdin.write("\r");
    await delay();
    const frame = lastFrame();
    expect(frame).toContain("Bonus XP");
    expect(frame).toContain("High HP");
    expect(frame).toContain("Better loot");
  });

  it("renders stats preview for selected class", async () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame, stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    stdin.write("\r");
    await delay();
    // Scholar is selected by default
    const frame = lastFrame();
    expect(frame).toContain("Scholar Stats");
    expect(frame).toContain("80"); // Scholar HP
  });

  it("selects class via number key and enters confirm phase", async () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame, stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    stdin.write("\r"); // submit name
    await delay();
    stdin.write("2"); // select Warrior
    await delay();
    const frame = lastFrame();
    expect(frame).toContain("Warrior");
    expect(frame).toContain("Confirm");
  });

  it("selects class via Enter and enters confirm phase", async () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame, stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    stdin.write("\r"); // submit name
    await delay();
    stdin.write("\r"); // select Scholar (default)
    await delay();
    const frame = lastFrame();
    expect(frame).toContain("Scholar");
    expect(frame).toContain("Confirm");
  });

  it("shows stats in confirm phase", async () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame, stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    stdin.write("\r"); // submit name
    await delay();
    stdin.write("1"); // select Scholar
    await delay();
    const frame = lastFrame();
    expect(frame).toContain("HP");
    expect(frame).toContain("ATK");
    expect(frame).toContain("DEF");
  });

  it("calls onCreatePlayer when confirmed with Enter", async () => {
    const onCreatePlayer = vi.fn();
    const { stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    stdin.write("\r"); // submit name "Hero"
    await delay();
    stdin.write("1"); // select Scholar → confirm
    await delay();
    stdin.write("\r"); // confirm
    expect(onCreatePlayer).toHaveBeenCalledWith("Hero", PlayerClass.Scholar);
  });

  it("goes back from confirm to class selection on Escape", async () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame, stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    stdin.write("\r"); // name submit
    await delay();
    stdin.write("1"); // class select
    await delay();
    expect(lastFrame()).toContain("Confirm");
    stdin.write("\x1B"); // escape
    await delay();
    expect(lastFrame()).toContain("Choose your class");
  });

  it("goes back from class selection to name entry on Escape", async () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame, stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    stdin.write("\r"); // name submit
    await delay();
    expect(lastFrame()).toContain("Choose your class");
    stdin.write("\x1B"); // escape
    await delay();
    expect(lastFrame()).toContain("Enter your name");
  });

  it("navigates class options with arrow keys", async () => {
    const onCreatePlayer = vi.fn();
    const { lastFrame, stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    stdin.write("\r"); // submit name
    await delay();
    // Default selection is Scholar (index 0)
    stdin.write("\x1B[B"); // down to Warrior
    await delay();
    const frame = lastFrame();
    expect(frame).toContain("Warrior Stats");
    expect(frame).toContain("120"); // Warrior HP
  });

  it("selects Warrior and confirms", async () => {
    const onCreatePlayer = vi.fn();
    const { stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    stdin.write("\r"); // name
    await delay();
    stdin.write("2"); // Warrior
    await delay();
    stdin.write("\r"); // confirm
    expect(onCreatePlayer).toHaveBeenCalledWith("Hero", PlayerClass.Warrior);
  });

  it("selects Rogue and confirms", async () => {
    const onCreatePlayer = vi.fn();
    const { stdin } = render(themed(<TitleScreen onCreatePlayer={onCreatePlayer} />));
    await delay();
    stdin.write("\r"); // name
    await delay();
    stdin.write("3"); // Rogue
    await delay();
    stdin.write("\r"); // confirm
    expect(onCreatePlayer).toHaveBeenCalledWith("Hero", PlayerClass.Rogue);
  });
});
