import React, { useEffect, useState } from "react";
import { Text, Box } from "ink";
import fs from "fs";
import path from "path";
import { getDatabase } from "../data/database.js";
import { buildExportData } from "../core/export.js";

interface Props {
  directory?: string;
}

export function ExportCommand({ directory }: Props) {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("");
  const [filePath, setFilePath] = useState("");
  const [cardCount, setCardCount] = useState(0);

  useEffect(() => {
    try {
      const dir = directory ? path.resolve(directory) : process.cwd();

      if (!fs.existsSync(dir)) {
        throw new Error(`Directory does not exist: ${dir}`);
      }

      const today = new Date().toISOString().slice(0, 10);
      const filename = `realm-of-recall-export-${today}.json`;
      const outputPath = path.join(dir, filename);

      const db = getDatabase();
      const { data, cardCount: count } = buildExportData(db);

      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");

      setFilePath(outputPath);
      setCardCount(count);
      setStatus("done");
    } catch (err: any) {
      setMessage(err.message);
      setStatus("error");
    }
  }, [directory]);

  if (status === "loading") {
    return <Text>Exporting...</Text>;
  }

  if (status === "error") {
    return <Text color="red">Error: {message}</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text color="green">
        Exported {cardCount} cards to {filePath}
      </Text>
    </Box>
  );
}
