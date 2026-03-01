#!/usr/bin/env node
import { Command } from "commander";
import React from "react";
import { render } from "ink";
import App from "../src/components/app/App.js";
import { ImportCommand } from "../src/commands/import.js";
import { ExportCommand } from "../src/commands/export.js";
import { closeDatabase } from "../src/data/database.js";

const program = new Command();

program
  .name("ror")
  .description("Realm of Recall — A CLI RPG powered by flashcard recall")
  .version("0.2.0")
  .action(() => {
    const { waitUntilExit } = render(React.createElement(App));
    waitUntilExit().then(() => {
      closeDatabase();
      process.exit(0);
    });
  });

program
  .command("import <file>")
  .description("Import a deck from JSON, CSV, or TSV file")
  .action((file: string) => {
    const { waitUntilExit } = render(
      React.createElement(ImportCommand, { filePath: file }),
    );
    waitUntilExit().then(() => {
      closeDatabase();
      process.exit(0);
    });
  });

program
  .command("export [directory]")
  .description("Export all decks, cards, and progress to a JSON file")
  .action((directory?: string) => {
    const { waitUntilExit } = render(
      React.createElement(ExportCommand, { directory }),
    );
    waitUntilExit().then(() => {
      closeDatabase();
      process.exit(0);
    });
  });

program.parse();
