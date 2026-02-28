import React from "react";
import { Text } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";

interface Props {
  amount: number;
  type: "dealt" | "received" | "critical";
}

export function DamageNumber({ amount, type }: Props) {
  const theme = useGameTheme();

  switch (type) {
    case "dealt":
      return <Text color={theme.colors.success}>{amount}</Text>;
    case "received":
      return <Text color={theme.colors.damage}>{amount}</Text>;
    case "critical":
      return (
        <Text bold color={theme.colors.gold}>
          CRIT! {amount}
        </Text>
      );
  }
}
