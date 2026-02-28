# Realm of Recall CLI

## Project Overview
CLI RPG where combat is powered by flashcard recall. Built with Ink (React for CLIs), SQLite, TypeScript.

## Tech Stack
- Runtime: Node.js 18+, TypeScript 5.4+
- Terminal UI: Ink v5 (React for CLIs)
- CLI framework: Commander
- Database: SQLite via better-sqlite3
- Testing: Vitest
- Build: tsup

## Architecture
- `src/core/` — Pure game logic (no UI, no I/O). All testable without Ink.
- `src/data/` — SQLite persistence layer
- `src/components/` — Ink UI components
- `src/commands/` — Commander subcommand handlers
- User data stored in `~/.realm-of-recall/` (game.db, config.json)

## Key Conventions
- ESM modules throughout (`"type": "module"` in package.json)
- Pure core logic — UI dispatches to core, never the other way
- SM-2 spaced repetition scheduling
- Card answer evaluation ported from Unity C# version

## Commands
- `npm run dev` — Run CLI in development
- `npm test` — Run all tests
- `npm run build` — Build with tsup
