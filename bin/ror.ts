#!/usr/bin/env node
import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { ImportCommand } from "../src/commands/import.js";
import { ReviewCommand } from "../src/commands/review.js";
import { DecksCommand } from "../src/commands/decks.js";
import { closeDatabase } from "../src/data/database.js";

const program = new Command();

program
  .name("ror")
  .description("Realm of Recall — A CLI RPG powered by flashcard recall")
  .version("0.1.0");

program
  .command("import <file>")
  .description("Import a deck from JSON, CSV, or TSV file")
  .action((file: string) => {
    const { waitUntilExit } = render(React.createElement(ImportCommand, { filePath: file }));
    waitUntilExit().then(() => {
      closeDatabase();
      process.exit(0);
    });
  });

program
  .command("review")
  .description("Review due flashcards")
  .option("-d, --deck <id>", "Review a specific deck")
  .option("-n, --limit <number>", "Limit number of cards", parseInt)
  .action((opts: { deck?: string; limit?: number }) => {
    const { waitUntilExit } = render(
      React.createElement(ReviewCommand, {
        deckId: opts.deck,
        limit: opts.limit,
      }),
    );
    waitUntilExit().then(() => {
      closeDatabase();
      process.exit(0);
    });
  });

program
  .command("decks")
  .description("List all imported decks")
  .action(() => {
    const { waitUntilExit } = render(React.createElement(DecksCommand));
    waitUntilExit().then(() => {
      closeDatabase();
      process.exit(0);
    });
  });

program.parse();
