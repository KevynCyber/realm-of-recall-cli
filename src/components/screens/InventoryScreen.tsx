import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";
import type { Equipment, EquipmentSlot } from "../../types/player.js";

interface InventoryEntry {
  equipment: Equipment;
  equipped: boolean;
  inventoryId: number;
}

interface Props {
  equippedItems: Equipment[];
  inventory: InventoryEntry[];
  onEquip: (inventoryId: number) => void;
  onUnequip: (inventoryId: number) => void;
  onBack: () => void;
}

type Mode = "backpack" | "equipped";

const EQUIPMENT_SLOTS: EquipmentSlot[] = ["weapon" as EquipmentSlot, "armor" as EquipmentSlot, "accessory" as EquipmentSlot];
const SLOT_LABELS: Record<string, string> = {
  weapon: "Weapon",
  armor: "Armor",
  accessory: "Accessory",
};

function getStatBonuses(eq: Equipment): string[] {
  const bonuses: string[] = [];
  if (eq.attackBonus > 0) bonuses.push(`+${eq.attackBonus} ATK`);
  if (eq.defenseBonus > 0) bonuses.push(`+${eq.defenseBonus} DEF`);
  if (eq.hpBonus > 0) bonuses.push(`+${eq.hpBonus} HP`);
  if (eq.xpBonusPct > 0) bonuses.push(`+${eq.xpBonusPct}% XP`);
  if (eq.goldBonusPct > 0) bonuses.push(`+${eq.goldBonusPct}% Gold`);
  if (eq.critBonusPct > 0) bonuses.push(`+${eq.critBonusPct}% Crit`);
  return bonuses;
}

export function InventoryScreen({
  equippedItems,
  inventory,
  onEquip,
  onUnequip,
  onBack,
}: Props) {
  const theme = useGameTheme();
  const [mode, setMode] = useState<Mode>("backpack");
  const [backpackIndex, setBackpackIndex] = useState(0);
  const [equippedSlotIndex, setEquippedSlotIndex] = useState(0);

  const unequippedItems = inventory.filter((item) => !item.equipped);

  const equippedBySlot = new Map<string, InventoryEntry>();
  for (const entry of inventory) {
    if (entry.equipped) {
      equippedBySlot.set(entry.equipment.slot, entry);
    }
  }

  // Determine the highlighted item for the detail panel
  let highlightedItem: Equipment | undefined;
  if (mode === "backpack" && unequippedItems.length > 0) {
    highlightedItem = unequippedItems[backpackIndex]?.equipment;
  } else if (mode === "equipped") {
    const slot = EQUIPMENT_SLOTS[equippedSlotIndex];
    const entry = equippedBySlot.get(slot);
    highlightedItem = entry?.equipment;
  }

  useInput((input, key) => {
    if (key.escape || input === "b") {
      if (mode === "equipped") {
        setMode("backpack");
      } else {
        onBack();
      }
      return;
    }

    if (input === "u") {
      setMode("equipped");
      setEquippedSlotIndex(0);
      return;
    }

    if (mode === "backpack") {
      if (key.upArrow) {
        setBackpackIndex((i) =>
          unequippedItems.length > 0
            ? i > 0
              ? i - 1
              : unequippedItems.length - 1
            : 0,
        );
      } else if (key.downArrow) {
        setBackpackIndex((i) =>
          unequippedItems.length > 0
            ? i < unequippedItems.length - 1
              ? i + 1
              : 0
            : 0,
        );
      } else if (key.return && unequippedItems.length > 0) {
        const entry = unequippedItems[backpackIndex];
        if (entry) {
          onEquip(entry.inventoryId);
          // Adjust index if we removed the last item
          if (backpackIndex >= unequippedItems.length - 1 && backpackIndex > 0) {
            setBackpackIndex(backpackIndex - 1);
          }
        }
      }
    } else if (mode === "equipped") {
      if (key.upArrow) {
        setEquippedSlotIndex((i) =>
          i > 0 ? i - 1 : EQUIPMENT_SLOTS.length - 1,
        );
      } else if (key.downArrow) {
        setEquippedSlotIndex((i) =>
          i < EQUIPMENT_SLOTS.length - 1 ? i + 1 : 0,
        );
      } else if (key.return) {
        const slot = EQUIPMENT_SLOTS[equippedSlotIndex];
        const entry = equippedBySlot.get(slot);
        if (entry) {
          onUnequip(entry.inventoryId);
        }
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold> Inventory</Text>

      {/* Equipment Section */}
      <Box
        flexDirection="column"
        borderStyle="single"
        paddingX={1}
        marginTop={1}
      >
        <Text bold>Equipment</Text>
        <Box flexDirection="column" marginTop={1}>
          {EQUIPMENT_SLOTS.map((slot, i) => {
            const entry = equippedBySlot.get(slot);
            const isSelected = mode === "equipped" && equippedSlotIndex === i;
            const prefix = isSelected ? "> " : "  ";
            const rarityColor = entry
              ? theme.rarityColors[
                  entry.equipment.rarity as keyof typeof theme.rarityColors
                ] ?? "white"
              : undefined;
            const bonuses = entry ? getStatBonuses(entry.equipment) : [];

            return (
              <Text key={slot}>
                <Text bold={isSelected}>{prefix}{SLOT_LABELS[slot]}:</Text>{" "}
                {entry ? (
                  <>
                    <Text color={rarityColor}>{entry.equipment.name}</Text>
                    {bonuses.length > 0 && (
                      <Text color={theme.colors.muted}>
                        {" "}({bonuses.join(", ")})
                      </Text>
                    )}
                  </>
                ) : (
                  <Text color={theme.colors.muted}>[Empty]</Text>
                )}
              </Text>
            );
          })}
        </Box>
      </Box>

      {/* Backpack + Detail Panel side by side */}
      <Box marginTop={1}>
        {/* Backpack Section */}
        <Box
          flexDirection="column"
          borderStyle="single"
          paddingX={1}
          minWidth={40}
        >
          <Text bold>Backpack</Text>
          <Box flexDirection="column" marginTop={1}>
            {unequippedItems.length === 0 ? (
              <Text color={theme.colors.muted}>No items in backpack</Text>
            ) : (
              unequippedItems.map((entry, i) => {
                const isSelected = mode === "backpack" && backpackIndex === i;
                const prefix = isSelected ? "> " : "  ";
                const rarityColor =
                  theme.rarityColors[
                    entry.equipment.rarity as keyof typeof theme.rarityColors
                  ] ?? "white";

                return (
                  <Text key={entry.inventoryId}>
                    <Text bold={isSelected}>{prefix}</Text>
                    <Text color={rarityColor}>{entry.equipment.name}</Text>
                    <Text color={theme.colors.muted}>
                      {" "}({entry.equipment.rarity}) — {SLOT_LABELS[entry.equipment.slot]}
                    </Text>
                  </Text>
                );
              })
            )}
          </Box>
        </Box>

        {/* Detail Panel */}
        {highlightedItem && (
          <Box
            flexDirection="column"
            borderStyle="single"
            paddingX={1}
            marginLeft={1}
            minWidth={30}
          >
            <Text bold>Details</Text>
            <Box flexDirection="column" marginTop={1}>
              <Text
                bold
                color={
                  theme.rarityColors[
                    highlightedItem.rarity as keyof typeof theme.rarityColors
                  ] ?? "white"
                }
              >
                {highlightedItem.name}
              </Text>
              <Text>
                <Text color={theme.colors.muted}>Rarity: </Text>
                <Text>{highlightedItem.rarity}</Text>
              </Text>
              <Text>
                <Text color={theme.colors.muted}>Slot: </Text>
                <Text>{SLOT_LABELS[highlightedItem.slot]}</Text>
              </Text>
              {getStatBonuses(highlightedItem).length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color={theme.colors.muted}>Bonuses:</Text>
                  {getStatBonuses(highlightedItem).map((bonus) => (
                    <Text key={bonus}>  {bonus}</Text>
                  ))}
                </Box>
              )}
              {highlightedItem.specialEffect && (
                <Box marginTop={1}>
                  <Text color={theme.colors.mana}>
                    Special: {highlightedItem.specialEffect}
                  </Text>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Box marginTop={1} paddingX={1}>
        <Text color={theme.colors.muted}>
          {mode === "backpack"
            ? "Up/Down: navigate | Enter: equip | u: manage equipped | b/Esc: back"
            : "Up/Down: select slot | Enter: unequip | b/Esc: back to backpack"}
        </Text>
      </Box>
    </Box>
  );
}
