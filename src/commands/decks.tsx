import React, { useEffect, useState } from "react";
import { Text, Box } from "ink";
import { getDatabase } from "../data/database.js";
import { CardRepository } from "../data/repositories/CardRepository.js";
import type { Deck } from "../types/index.js";

export function DecksCommand() {
  const [decks, setDecks] = useState<(Deck & { cardCount: number })[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const db = getDatabase();
      const repo = new CardRepository(db);
      const allDecks = repo.getAllDecks();
      const withCounts = allDecks.map((deck) => ({
        ...deck,
        cardCount: repo.getCardCount(deck.id),
      }));
      setDecks(withCounts);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (!decks) {
    return <Text>Loading...</Text>;
  }

  if (decks.length === 0) {
    return (
      <Text dimColor>No decks found. Import one: ror import &lt;file&gt;</Text>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Your Decks
      </Text>
      <Text> </Text>
      {decks.map((deck) => (
        <Box key={deck.id}>
          <Text>
            <Text bold>{deck.name}</Text>
            <Text dimColor>
              {" "}
              ({deck.cardCount} cards)
            </Text>
          </Text>
        </Box>
      ))}
    </Box>
  );
}
