# Realm of Recall

A CLI RPG where combat is powered by flashcard recall. Built with Ink, SQLite, and TypeScript.

Learn anything through spaced repetition, gamified with RPG combat, progression, and loot.

## Features

- **RPG Combat** — Answer flashcards to deal damage. Perfect answers crit, wrong answers let enemies strike back.
- **Player Classes** — Scholar (bonus XP), Warrior (high HP/ATK), Rogue (bonus gold/crit).
- **FSRS Scheduling** — Modern spaced repetition algorithm for optimal review timing.
- **Equipment & Loot** — Defeat enemies to earn gear across 4 rarities (common, uncommon, rare, epic).
- **Streak System** — Daily study streaks with XP bonuses (up to +50% at 30 days) and shield protection.
- **World Map** — Zone progression tied to deck mastery with boss fights.
- **Fullscreen TUI** — Polished terminal interface with keyboard navigation.

## Install

```bash
npm install
```

## Usage

```bash
# Launch the game
npx tsx bin/ror.ts

# Import a deck (creates a zone on the world map)
npx tsx bin/ror.ts import assets/sample-decks/geography.json
```

On first launch, you'll create a character (name + class), then navigate from the hub:

1. **Adventure** — Enter combat with due flashcards
2. **Quick Review** — Review cards without combat (still earns XP)
3. **Inventory** — Manage equipment (equip/unequip)
4. **World Map** — View zone progression and mastery
5. **Stats** — View player statistics and streaks
6. **Manage Decks** — Toggle which decks are active for reviews and combat

## Deck Formats

**JSON**
```json
{
  "name": "My Deck",
  "description": "Optional description",
  "cards": [
    {
      "front": "What is the capital of France?",
      "back": "Paris",
      "acceptableAnswers": ["Paris"]
    }
  ]
}
```

**CSV/TSV** — two columns: front, back. Optional header row.
```
front,back
What is 2+2?,4
Capital of Japan?,Tokyo
```

Cloze deletions are supported: `{{c1::answer::hint}}`

## Spaced Repetition

Cards are scheduled using the FSRS algorithm (via ts-fsrs). Answer quality affects scheduling:

- **Perfect** (fast exact match) — Easy rating, longer interval
- **Correct** (exact match) — Good rating, normal interval
- **Partial** (substring match) — Hard rating, shorter interval
- **Wrong** / **Timeout** — Again rating, relearn

## Development

```bash
npm test          # Run tests (207 tests)
npm run dev       # Run CLI in dev mode
npm run build     # Build with tsup
```

## Architecture

- `src/core/` — Pure game logic (combat, progression, scheduling). No UI, no I/O.
- `src/data/` — SQLite persistence layer (repositories, migrations)
- `src/components/` — Ink UI components (screens, combat UI, review)
- `src/importers/` — Deck import logic (JSON, CSV/TSV)
- `src/types/` — TypeScript type definitions

## Data

User data is stored in `~/.realm-of-recall/game.db` (SQLite).
