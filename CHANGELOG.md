# Changelog

## [0.1.0] - 2026-02-28

### Added

- Project scaffolding (TypeScript, Ink v5, Commander, SQLite, Vitest, tsup)
- SQLite database with migrations for cards, decks, recall_stats, recall_attempts
- Core card logic ported from Unity C#:
  - `CardEvaluator` — answer evaluation (Perfect/Correct/Partial/Wrong/Timeout)
  - `ClozeParser` — Anki-style `{{c1::answer::hint}}` cloze deletion parsing
  - `RecallTracker` — per-card accuracy, streaks, difficulty tracking
- SM-2 spaced repetition scheduler with ease factor, intervals, and repetitions
- JSON deck importer
- CSV/TSV deck importer with quoted field support
- Card and Stats repositories (SQLite CRUD)
- Ink UI components: FlashcardFace, ReviewScreen, ReviewSummary, ProgressBar, SelectMenu
- CLI commands:
  - `ror import <file>` — import decks from JSON, CSV, or TSV
  - `ror review` — interactive flashcard review with SM-2 scheduling
  - `ror decks` — list imported decks
- Bundled sample deck (World Geography — 10 cards)
- 53 unit/integration tests across 6 test files
