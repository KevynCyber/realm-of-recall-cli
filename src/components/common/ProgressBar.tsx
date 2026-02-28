import React from "react";
import { Text } from "ink";

interface Props {
  value: number; // 0-1
  width?: number;
  filledChar?: string;
  emptyChar?: string;
  filledColor?: string;
  emptyColor?: string;
  color?: string;
  label?: string;
}

export function ProgressBar({
  value,
  width = 20,
  filledChar = "█",
  emptyChar = "░",
  filledColor = "green",
  emptyColor = "gray",
  color,
  label,
}: Props) {
  const clamped = Math.max(0, Math.min(1, value));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  const barColor = color ?? filledColor;

  return (
    <Text>
      <Text color={barColor}>{filledChar.repeat(filled)}</Text>
      <Text color={emptyColor}>{emptyChar.repeat(empty)}</Text>
      {label ? <Text> {label}</Text> : null}
    </Text>
  );
}
