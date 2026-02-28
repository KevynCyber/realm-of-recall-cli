import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface SelectItem {
  label: string;
  value: string;
}

interface Props {
  items: SelectItem[];
  onSelect: (value: string) => void;
}

export function SelectMenu({ items, onSelect }: Props) {
  const [index, setIndex] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) {
      setIndex((i) => (i > 0 ? i - 1 : items.length - 1));
    } else if (key.downArrow) {
      setIndex((i) => (i < items.length - 1 ? i + 1 : 0));
    } else if (key.return) {
      onSelect(items[index].value);
    }
  });

  return (
    <Box flexDirection="column">
      {items.map((item, i) => (
        <Text key={item.value}>
          <Text color={i === index ? "cyan" : "white"}>
            {i === index ? "❯ " : "  "}
          </Text>
          <Text color={i === index ? "cyan" : "white"}>{item.label}</Text>
        </Text>
      ))}
    </Box>
  );
}
