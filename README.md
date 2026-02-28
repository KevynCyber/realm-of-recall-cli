# Realm of Recall

A CLI RPG where combat is powered by flashcard recall. Built with Ink, SQLite, and TypeScript.

Learn anything through spaced repetition, gamified with RPG combat, progression, and memory techniques.

## Install

```bash
npm install
```

## Usage

```bash
# Import a deck
npx tsx bin/ror.ts import assets/sample-decks/geography.json

# Review due cards
npx tsx bin/ror.ts review

# Review with a card limit
npx tsx bin/ror.ts review -n 5

# List your decks
npx tsx bin/ror.ts decks
```

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

Cards are scheduled using the SM-2 algorithm. Answer quality affects when you'll see a card again:

- **Perfect** (fast exact match) — longer interval
- **Correct** (exact match) — normal interval
- **Partial** (substring match) — shorter interval
- **Wrong** / **Timeout** — reset to 1 day

## Development

```bash
npm test          # Run tests
npm run dev       # Run CLI in dev mode
npm run build     # Build with tsup
```

## Data

User data is stored in `~/.realm-of-recall/game.db` (SQLite).
