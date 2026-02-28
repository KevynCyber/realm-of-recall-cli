import React, { useEffect, useState } from "react";
import { Text, Box } from "ink";
import path from "path";
import { getDatabase } from "../data/database.js";
import { CardRepository } from "../data/repositories/CardRepository.js";
import { ZoneRepository } from "../data/repositories/ZoneRepository.js";
import { importJson } from "../importers/JsonImporter.js";
import { importCsv } from "../importers/CsvImporter.js";
import { importApkg } from "../importers/ApkgImporter.js";

interface Props {
  filePath: string;
}

export function ImportCommand({ filePath }: Props) {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("");
  const [cardCount, setCardCount] = useState(0);
  const [deckName, setDeckName] = useState("");

  useEffect(() => {
    try {
      const resolved = path.resolve(filePath);
      const ext = path.extname(resolved).toLowerCase();

      let result: ReturnType<typeof importJson>;
      if (ext === ".json") {
        result = importJson(resolved);
      } else if (ext === ".csv" || ext === ".tsv") {
        result = importCsv(resolved);
      } else if (ext === ".apkg") {
        result = importApkg(resolved);
      } else {
        throw new Error(`Unsupported file type: ${ext}. Use .json, .csv, .tsv, or .apkg`);
      }

      const db = getDatabase();
      const repo = new CardRepository(db);
      repo.createDeck(result.deck);
      repo.insertCards(result.cards);

      // Auto-create a zone for the imported deck
      const zoneRepo = new ZoneRepository(db);
      const existingZone = zoneRepo.getZoneByDeckId(result.deck.id);
      if (!existingZone) {
        const zoneCount = zoneRepo.getZones().length;
        zoneRepo.createZone({
          id: `zone-${result.deck.id}`,
          name: result.deck.name,
          deckId: result.deck.id,
          requiredMastery: 0.7,
          bossDefeated: false,
          orderIndex: zoneCount,
        });
      }

      setDeckName(result.deck.name);
      setCardCount(result.cards.length);
      setStatus("done");
    } catch (err: any) {
      setMessage(err.message);
      setStatus("error");
    }
  }, [filePath]);

  if (status === "loading") {
    return <Text>Importing...</Text>;
  }

  if (status === "error") {
    return <Text color="red">Error: {message}</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text color="green">
        Imported deck "{deckName}" with {cardCount} cards.
      </Text>
    </Box>
  );
}
