import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { ProgressBar } from "../../src/components/common/ProgressBar.js";
import { SelectMenu } from "../../src/components/common/SelectMenu.js";

const delay = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

describe("ProgressBar", () => {
  it("renders a full bar when value is 1", () => {
    const { lastFrame } = render(<ProgressBar value={1} width={10} />);
    const frame = lastFrame();
    expect(frame).toContain("█".repeat(10));
    expect(frame).not.toContain("░");
  });

  it("renders an empty bar when value is 0", () => {
    const { lastFrame } = render(<ProgressBar value={0} width={10} />);
    const frame = lastFrame();
    expect(frame).toContain("░".repeat(10));
  });

  it("renders a half-full bar when value is 0.5", () => {
    const { lastFrame } = render(<ProgressBar value={0.5} width={10} />);
    const frame = lastFrame();
    expect(frame).toContain("█".repeat(5));
    expect(frame).toContain("░".repeat(5));
  });

  it("clamps value above 1", () => {
    const { lastFrame } = render(<ProgressBar value={2} width={10} />);
    const frame = lastFrame();
    expect(frame).toContain("█".repeat(10));
  });

  it("clamps value below 0", () => {
    const { lastFrame } = render(<ProgressBar value={-1} width={10} />);
    const frame = lastFrame();
    expect(frame).toContain("░".repeat(10));
  });

  it("renders a label when provided", () => {
    const { lastFrame } = render(
      <ProgressBar value={0.5} width={10} label="50%" />,
    );
    expect(lastFrame()).toContain("50%");
  });

  it("uses custom filled/empty characters", () => {
    const { lastFrame } = render(
      <ProgressBar value={0.5} width={4} filledChar="=" emptyChar="-" />,
    );
    const frame = lastFrame();
    expect(frame).toContain("==");
    expect(frame).toContain("--");
  });
});

describe("SelectMenu", () => {
  const items = [
    { label: "Option A", value: "a" },
    { label: "Option B", value: "b" },
    { label: "Option C", value: "c" },
  ];

  it("renders all menu items", () => {
    const onSelect = vi.fn();
    const { lastFrame } = render(
      <SelectMenu items={items} onSelect={onSelect} />,
    );
    const frame = lastFrame();
    expect(frame).toContain("Option A");
    expect(frame).toContain("Option B");
    expect(frame).toContain("Option C");
  });

  it("highlights the first item by default", () => {
    const onSelect = vi.fn();
    const { lastFrame } = render(
      <SelectMenu items={items} onSelect={onSelect} />,
    );
    expect(lastFrame()).toContain("❯ Option A");
  });

  it("moves selection down on downArrow", async () => {
    const onSelect = vi.fn();
    const { lastFrame, stdin } = render(
      <SelectMenu items={items} onSelect={onSelect} />,
    );
    await delay();
    stdin.write("\x1B[B");
    expect(lastFrame()).toContain("❯ Option B");
  });

  it("moves selection up on upArrow", async () => {
    const onSelect = vi.fn();
    const { lastFrame, stdin } = render(
      <SelectMenu items={items} onSelect={onSelect} />,
    );
    await delay();
    stdin.write("\x1B[B"); // down to B
    stdin.write("\x1B[A"); // back up to A
    expect(lastFrame()).toContain("❯ Option A");
  });

  it("wraps selection from last to first on downArrow", async () => {
    const onSelect = vi.fn();
    const { lastFrame, stdin } = render(
      <SelectMenu items={items} onSelect={onSelect} />,
    );
    await delay();
    stdin.write("\x1B[B"); // B
    stdin.write("\x1B[B"); // C
    stdin.write("\x1B[B"); // wrap to A
    expect(lastFrame()).toContain("❯ Option A");
  });

  it("wraps selection from first to last on upArrow", async () => {
    const onSelect = vi.fn();
    const { lastFrame, stdin } = render(
      <SelectMenu items={items} onSelect={onSelect} />,
    );
    await delay();
    stdin.write("\x1B[A"); // wrap to C
    expect(lastFrame()).toContain("❯ Option C");
  });

  it("calls onSelect with correct value on Enter", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <SelectMenu items={items} onSelect={onSelect} />,
    );
    await delay();
    stdin.write("\x1B[B"); // move to B
    await delay(); // flush React state update
    stdin.write("\r"); // enter
    expect(onSelect).toHaveBeenCalledWith("b");
  });
});
