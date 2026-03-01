# Realm of Recall

A CLI RPG where combat is powered by flashcard recall. Built with Ink, SQLite, and TypeScript.

Learn anything through spaced repetition, gamified with RPG combat, progression, and loot.

## Features

- **RPG Combat** — Answer flashcards to deal damage. Perfect answers crit, wrong answers let enemies strike back.
- **Dungeon Run** — 5-floor gauntlet with scaling difficulty, random events between floors, and bonus rewards.
- **Daily Challenge** — Seeded daily encounters with scoring leaderboard (accuracy + speed + damage).
- **Player Classes** — Scholar (Reveal/Insight/Wisdom Surge), Warrior (Endure/Battle Cry/Fortify), Rogue (Steal/Shadow Strike/Lucky Find).
- **Class Abilities** — 9 abilities with SP costs and cooldowns, unlocking at levels 3/7/12.
- **Ascension System** — 10 difficulty levels with cumulative modifiers for replayability.
- **FSRS Scheduling** — Modern spaced repetition algorithm for optimal review timing.
- **Diminishing-Cues Hints** — Press [H] for progressive hints (first letter, every 3rd, every other, full reveal).
- **Cross-Deck Interleaving** — Cards mixed across decks for 30% better retention (Bjork research).
- **24 Achievements** — Track accomplishments across Learning, Combat, Progression, and Exploration.
- **Confidence Rating** — Rate your confidence after correct answers for smarter scheduling.
- **Card Evolution** — Cards evolve through 4 tiers (New → Learned → Proven → Mastered) with combat bonuses.
- **Retrieval Modes** — Standard, Reversed, Teach, and Connect modes for deeper learning.
- **Random Events** — 8 event types (treasures, merchants, shrines, blessings, rest camps, curses, wisdom wells, streak guardians).
- **Post-Session Reflection** — Earn Wisdom XP through micro-reflections and optional journaling.
- **Equipment & Loot** — Defeat enemies to earn gear across 4 rarities.
- **Streak System** — Daily study streaks with XP bonuses (up to +50% at 30 days) and shield protection.
- **World Map** — Zone progression tied to deck mastery with boss fights.
- **Progress Dashboard** — Sparkline trends, consistency grids, and marginal gains tracking.
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
3. **Dungeon Run** — 5-floor gauntlet with random events
4. **Daily Challenge** — Today's seeded challenge with scoring
5. **Inventory** — Manage equipment (equip/unequip)
6. **World Map** — View zone progression and mastery
7. **Achievements** — Track your accomplishments
8. **Stats** — View player statistics and streaks
9. **Manage Decks** — Toggle which decks are active for reviews and combat

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

Confidence ratings further adjust scheduling: a "Lucky Guess" correct answer gets a shorter interval than an "Instant Recall" correct answer.

## Development

```bash
npm test          # Run tests (669 tests)
npm run dev       # Run CLI in dev mode
npm run build     # Build with tsup
```

## Architecture

- `src/core/` — Pure game logic (combat, progression, scheduling). No UI, no I/O.
- `src/data/` — SQLite persistence layer (repositories, migrations)
- `src/components/` — Ink UI components (screens, combat UI, review)
- `src/types/` — TypeScript type definitions

## Data

User data is stored in `~/.realm-of-recall/game.db` (SQLite).
