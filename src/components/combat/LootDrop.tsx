import React from "react";
import { Box, Text, useInput } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";
import type { Equipment } from "../../types/player.js";

interface Props {
  equipment: Equipment;
  onDismiss: () => void;
}

export function LootDrop({ equipment, onDismiss }: Props) {
  const theme = useGameTheme();
  const rarityColor =
    theme.rarityColors[equipment.rarity as keyof typeof theme.rarityColors] ??
    "white";

  useInput((_input, key) => {
    if (key.return) {
      onDismiss();
    }
  });

  const bonuses: string[] = [];
  if (equipment.attackBonus > 0) bonuses.push(`+${equipment.attackBonus} ATK`);
  if (equipment.defenseBonus > 0) bonuses.push(`+${equipment.defenseBonus} DEF`);
  if (equipment.hpBonus > 0) bonuses.push(`+${equipment.hpBonus} HP`);
  if (equipment.xpBonusPct > 0) bonuses.push(`+${equipment.xpBonusPct}% XP`);
  if (equipment.goldBonusPct > 0) bonuses.push(`+${equipment.goldBonusPct}% Gold`);
  if (equipment.critBonusPct > 0) bonuses.push(`+${equipment.critBonusPct}% Crit`);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={rarityColor}
      paddingX={2}
      paddingY={1}
    >
      <Text bold color={theme.colors.gold}>
        Loot Found!
      </Text>
      <Text bold color={rarityColor}>
        {equipment.name}
      </Text>
      <Text>
        <Text color={theme.colors.muted}>Slot: </Text>
        <Text>{equipment.slot}</Text>
      </Text>
      {bonuses.length > 0 && (
        <Text>
          <Text color={theme.colors.muted}>Stats: </Text>
          <Text>{bonuses.join(", ")}</Text>
        </Text>
      )}
      {equipment.specialEffect && (
        <Text>
          <Text color={theme.colors.mana}>Special: </Text>
          <Text>{equipment.specialEffect}</Text>
        </Text>
      )}
      <Text> </Text>
      <Text color={theme.colors.muted}>Press Enter to continue</Text>
    </Box>
  );
}
