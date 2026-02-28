# Realm of Recall CLI — Product Requirements Document

**Version**: 0.2.0 — The Gamification Overhaul
**Date**: 2026-02-28

## Executive Summary

Transform Realm of Recall from a basic flashcard reviewer (v0.1.0) into a fully gamified CLI RPG where learning is powered by combat, progression, and strategic choice. The terminal experience should feel polished and immersive — inspired by the TUI quality of opencode and claude-code, but applied to an RPG game loop.

---

## Architecture Decisions

### AD-1: Stay on Ink v5 / React 18

**Decision**: Remain on Ink v5 with React 18.
**Rationale**: Ink v6 requires React 19 and Node 20. Staying on v5 keeps the project accessible on Node 18+ and avoids reconciler compatibility risks. The Ink v5 API is sufficient for a polished fullscreen experience.

### AD-2: FSRS Replaces SM-2

**Decision**: Replace the SM-2 scheduler with FSRS via `ts-fsrs`.
**Rationale**: FSRS outperforms SM-2 in 91.9% of cases, requiring 20-30% fewer reviews for the same retention level. The `ts-fsrs` package is production-ready, supports ESM, and targets Node 18+. The existing SM-2 code is removed (not kept as fallback — simplicity over choice).

### AD-3: Fullscreen Alternate Screen Buffer

**Decision**: Use `fullscreen-ink` for the main game interface.
**Rationale**: RPG immersion requires owning the terminal. Alternate screen buffer (like vim/htop) lets us build a persistent layout with header, content area, and status bar. On exit, the original terminal state is restored cleanly.

### AD-4: State Machine Screen Navigation

**Decision**: Navigate between screens via a simple `useState<Screen>` state machine — no router library.
**Rationale**: An RPG has a fixed set of screens (title, hub, combat, review, inventory, map). A switch statement on screen state is simpler and more debuggable than a routing library.

### AD-5: useReducer for Game State

**Decision**: Use `useReducer` with a pure reducer function for all game state mutations.
**Rationale**: Combat involves complex state transitions (HP changes, turn progression, loot calculation). A reducer keeps mutations pure and testable. The reducer function lives in `src/core/` and can be unit-tested without Ink.

### AD-6: SQLite for All Persistence

**Decision**: Continue using better-sqlite3 for all game data.
**Rationale**: Single-file database, zero network dependency, synchronous API (no async overhead in a CLI). New tables added via the existing migration system.

### AD-7: @inkjs/ui for UI Components

**Decision**: Use `@inkjs/ui` v2 as the primary component library. Remove standalone `ink-text-input`.
**Rationale**: `@inkjs/ui` provides TextInput, Select, Spinner, ProgressBar, and a theming system — all from one maintained package.

---

## Feature Specifications

### F-1: Fullscreen TUI Shell

The main game interface uses fullscreen mode with a persistent layout:

```
┌─────────────────────────────────────────────────┐
│  Realm of Recall    Day 14    Streak: 7 days    │  ← Header
├─────────────────────────────────────────────────┤
│                                                  │
│  [Screen-specific content]                       │  ← Content (flexGrow)
│  - Combat arena                                  │
│  - Card review                                   │
│  - Hub menu                                      │
│  - Inventory grid                                │
│  - Zone map                                      │
│                                                  │
├─────────────────────────────────────────────────┤
│  Lv.5 Scholar  HP ████████░░ 80/100  XP 450/500 │  ← Status bar
│  Gold: 340  Cards Due: 15   [h]Help [q]Quit     │
└─────────────────────────────────────────────────┘
```

**Key patterns:**
- `fullscreen-ink` for alternate screen buffer
- `<Box flexDirection="column">` with header (fixed), content (`flexGrow={1}`), footer (fixed)
- Keyboard shortcuts displayed contextually per screen
- Color theme via React context: damage (red), healing (green), XP (magenta), gold (yellow), rare (cyan)

### F-2: Player System

On first launch, the player creates a character:
- Choose a name
- Choose a class: **Scholar**, **Warrior**, **Rogue**

**Player stats** (stored in SQLite):

| Stat | Base | Scholar | Warrior | Rogue |
|------|------|---------|---------|-------|
| Max HP | 100 | 80 | 120 | 100 |
| Attack | 10 | 8 | 14 | 11 |
| Defense | 5 | 4 | 7 | 5 |
| XP Bonus | 0% | +20% | 0% | 0% |
| Gold Bonus | 0% | 0% | 0% | +25% |
| Crit Chance | 5% | 5% | 8% | 12% |

**Leveling**: `XP_to_next = floor(100 * level^1.5)`. Each level grants +5 max HP, +2 attack, +1 defense. Every 5th level is a "milestone" with a bonus skill point.

**Persistence**: `player` table in SQLite. Single row (single-player game).

### F-3: FSRS Scheduling

Replace `src/core/spaced-repetition/Scheduler.ts` with FSRS-based scheduling.

**New ScheduleData**:
```typescript
interface ScheduleData {
  cardId: string;
  difficulty: number;    // FSRS difficulty [1-10]
  stability: number;     // FSRS stability (days)
  reps: number;
  lapses: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
  due: string;           // ISO date
  lastReview: string;    // ISO date
}
```

**Quality → FSRS Rating mapping**:
- Perfect → Easy
- Correct → Good
- Partial → Hard
- Wrong → Again
- Timeout → Again

**Migration**: New migration `002_fsrs` adds FSRS columns to `recall_stats`, converts existing SM-2 data (map easeFactor inversely to difficulty, use intervalDays as initial stability).

### F-4: Combat System

Combat is the core gameplay loop. Each combat encounter presents flashcards as "attacks."

**Combat flow:**
1. Player encounters an enemy (triggered from Hub or Zone exploration)
2. A flashcard is shown as the "attack prompt"
3. Player answers → answer quality determines combat outcome
4. Repeat until enemy HP reaches 0 (victory) or player HP reaches 0 (defeat)

**Answer → Combat mapping:**

| Quality | Combat Effect | XP Modifier |
|---------|--------------|-------------|
| Perfect | Critical hit: `attack * 2.0` damage | 1.5x |
| Correct | Normal hit: `attack * 1.0` damage | 1.0x |
| Partial | Glancing blow: `attack * 0.5` damage | 0.5x |
| Wrong | Enemy attacks: `enemy_attack - defense` damage to player | 0.25x |
| Timeout | Enemy attacks + poison: damage + 5 DoT next turn | 0x |

**Turn structure:**
1. Show card front + enemy info
2. Player types answer
3. Evaluate answer → resolve damage
4. Check win/lose conditions
5. If enemy alive and player alive → next card

**After combat:**
- Victory: Earn XP (base XP * answer quality modifiers), gold, possible loot drop
- Defeat: Lose 10% of gold (minimum 0), respawn at hub. No XP penalty.

### F-5: Enemy System

Enemies are generated from card FSRS difficulty.

**Enemy tiers:**

| Tier | Difficulty Range | Name Pool | HP Multiplier | Attack |
|------|-----------------|-----------|---------------|--------|
| Minion | D < 3 | Slime, Bat, Rat | 0.5x | 5-8 |
| Common | D 3-5 | Goblin, Skeleton, Spider | 1.0x | 8-12 |
| Elite | D 5-7 | Knight, Mage, Assassin | 1.5x | 12-18 |
| Boss | D 7+ | Dragon, Lich, Demon | 3.0x | 18-25 |

**Base HP**: `30 + (player_level * 5)`, then multiplied by tier multiplier.

**Enemy loot tables**: Each tier has a weighted loot table. Higher tiers have better drop rates for rare equipment.

### F-6: Equipment & Loot

Three equipment slots: **Weapon**, **Armor**, **Accessory**.

**Rarity tiers** (with terminal colors):
- Common (white): +1-2 to a stat
- Uncommon (green): +3-4 to a stat
- Rare (cyan): +5-7 to a stat + minor special effect
- Epic (magenta): +8-10 to a stat + major special effect

**Drop rates after combat victory:**
- No drop: 40%
- Common: 35%
- Uncommon: 18%
- Rare: 6%
- Epic: 1%

**Equipment examples:**
- Quill of Recall (Weapon, Rare): +6 attack, Perfect answers deal +3 bonus damage
- Scholar's Robe (Armor, Uncommon): +4 defense, +5% XP bonus
- Lucky Coin (Accessory, Common): +2 gold bonus per combat

Equipment is stored in `equipment` and `inventory` tables.

### F-7: Streak System

Daily study streaks — the highest-impact engagement feature.

**Rules:**
- A "study day" requires completing at least 1 review session (minimum 5 cards)
- Streak increments once per calendar day (UTC)
- Missing a day resets the streak to 0 (unless a Shield is active)

**Streak rewards:**
- 3-day streak: +10% XP bonus
- 7-day streak: +20% XP bonus + bonus gold
- 14-day streak: +30% XP bonus + rare loot chance +2%
- 30-day streak: +50% XP bonus + "Dedicated" title

**Shield item**: Purchased with 100 gold. Prevents streak reset for 1 missed day. Max 3 shields in inventory.

**Display**: Streak counter shown in the header bar at all times. Visual flame icon (🔥 or unicode equivalent) next to count.

### F-8: Zone / World Map

Zones are tied to decks and provide structured progression.

**Zone structure:**
- Each imported deck automatically creates a zone
- Zones have a mastery requirement (default 70% of cards at "review" state in FSRS)
- Completing a zone's mastery requirement unlocks a Boss fight
- Defeating the Boss marks the zone as "cleared"

**Zone map display** (ASCII):
```
  [Starter Meadow] ✓     cleared
       |
  [Crystal Caves] ◆      in progress (45% mastery)
       |
  [Shadow Library] ○      locked (requires Crystal Caves)
       |
  [Dragon Peak] ○         locked
```

**Hub zone**: Always available. Random encounters pull from all imported decks. This is the "quick play" option.

### F-9: Hub Screen

The hub is the central navigation point after character creation:

```
╭──────────────────────────────────────╮
│         Realm of Recall              │
│                                      │
│  [1] Adventure  — Enter a zone       │
│  [2] Quick Review — Review due cards │
│  [3] Inventory  — Manage equipment   │
│  [4] World Map  — View progression   │
│  [5] Import     — Add new decks      │
│  [6] Stats      — View statistics    │
│                                      │
│  15 cards due today                  │
╰──────────────────────────────────────╯
```

- Number keys for quick selection
- "Cards due today" count from FSRS scheduler
- If streak is at risk (haven't studied today), show a warning

### F-10: Stats Screen

Show player statistics:
- Total cards reviewed (all time)
- Today's session stats (cards reviewed, accuracy %)
- Current streak + longest streak
- Cards by FSRS state (new / learning / review / relearning)
- Average retention rate
- Level progress bar
- Combat record (wins / losses)

---

## Database Schema (Migration 002)

```sql
-- Migration: 002_gamification
CREATE TABLE player (
  id INTEGER PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'Hero',
  class TEXT NOT NULL DEFAULT 'scholar',
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  hp INTEGER NOT NULL DEFAULT 100,
  max_hp INTEGER NOT NULL DEFAULT 100,
  attack INTEGER NOT NULL DEFAULT 10,
  defense INTEGER NOT NULL DEFAULT 5,
  gold INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_review_date TEXT,
  shield_count INTEGER NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  total_correct INTEGER NOT NULL DEFAULT 0,
  combat_wins INTEGER NOT NULL DEFAULT 0,
  combat_losses INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slot TEXT NOT NULL CHECK(slot IN ('weapon', 'armor', 'accessory')),
  rarity TEXT NOT NULL DEFAULT 'common' CHECK(rarity IN ('common', 'uncommon', 'rare', 'epic')),
  attack_bonus INTEGER NOT NULL DEFAULT 0,
  defense_bonus INTEGER NOT NULL DEFAULT 0,
  hp_bonus INTEGER NOT NULL DEFAULT 0,
  xp_bonus_pct INTEGER NOT NULL DEFAULT 0,
  gold_bonus_pct INTEGER NOT NULL DEFAULT 0,
  crit_bonus_pct INTEGER NOT NULL DEFAULT 0,
  special_effect TEXT
);

CREATE TABLE inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL DEFAULT 1 REFERENCES player(id),
  equipment_id TEXT NOT NULL REFERENCES equipment(id),
  equipped INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  required_mastery REAL NOT NULL DEFAULT 0.7,
  boss_defeated INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0
);

-- Add FSRS columns to recall_stats
ALTER TABLE recall_stats ADD COLUMN difficulty REAL NOT NULL DEFAULT 5.0;
ALTER TABLE recall_stats ADD COLUMN stability REAL NOT NULL DEFAULT 0;
ALTER TABLE recall_stats ADD COLUMN lapses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recall_stats ADD COLUMN card_state TEXT NOT NULL DEFAULT 'new';
ALTER TABLE recall_stats ADD COLUMN last_review_at TEXT;
```

---

## New File Structure

```
src/
  core/
    combat/
      CombatEngine.ts        — Turn resolution, damage calc, win/loss
      EnemyGenerator.ts      — Generate enemies from card difficulty
      LootTable.ts           — Weighted random equipment drops
    progression/
      XPCalculator.ts        — XP from answers, bonuses from class/streak/equipment
      LevelSystem.ts         — Level thresholds, stat growth per level
      StreakTracker.ts        — Daily streak logic, shield mechanics
    player/
      PlayerStats.ts         — Compute effective stats (base + equipment + level)
      ClassDefinitions.ts    — Scholar/Warrior/Rogue base stats
    spaced-repetition/
      Scheduler.ts           — REWRITE: FSRS-based scheduling
    cards/
      CardEvaluator.ts       — (existing, unchanged)
      ClozeParser.ts         — (existing, unchanged)
  data/
    database.ts              — (existing, add migration 002)
    repositories/
      CardRepository.ts      — (existing, unchanged)
      StatsRepository.ts     — (existing, update for FSRS fields)
      PlayerRepository.ts    — NEW: player CRUD
      EquipmentRepository.ts — NEW: equipment + inventory CRUD
      ZoneRepository.ts      — NEW: zone CRUD
  components/
    app/
      App.tsx                — NEW: fullscreen shell, screen router, theme
      Header.tsx             — NEW: persistent header bar
      StatusBar.tsx          — NEW: persistent bottom status bar
      ThemeProvider.tsx       — NEW: color theme context
    screens/
      TitleScreen.tsx        — NEW: first-launch character creation
      HubScreen.tsx          — NEW: main menu hub
      CombatScreen.tsx       — NEW: combat encounter UI
      InventoryScreen.tsx    — NEW: equipment management
      MapScreen.tsx          — NEW: zone/world map
      StatsScreen.tsx        — NEW: player statistics
    review/
      ReviewScreen.tsx       — (existing, integrate into fullscreen layout)
      FlashcardFace.tsx      — (existing, unchanged)
      ReviewSummary.tsx      — (existing, update with XP/gold earned)
    combat/
      EnemyDisplay.tsx       — NEW: enemy name, HP bar, ASCII sprite
      CombatLog.tsx          — NEW: scrollable combat action log
      LootDrop.tsx           — NEW: loot reveal animation
      DamageNumber.tsx       — NEW: animated damage display
    common/
      ProgressBar.tsx        — (existing, enhance with color themes)
      SelectMenu.tsx         — (existing, replace with @inkjs/ui Select)
  commands/
    index.ts                 — NEW: single entry point, launch fullscreen app
    import.tsx               — (existing, update to work within fullscreen)
  types/
    index.ts                 — (existing, extend with new types)
    combat.ts                — NEW: combat-specific types
    player.ts                — NEW: player/equipment types
```

---

## Testing Strategy

### New Test Coverage

| Area | Package | Approach |
|------|---------|----------|
| FSRS scheduler | vitest | Known-value verification against FSRS spec, property-based with fast-check |
| Combat engine | vitest + fast-check | Property tests: HP never negative, damage always resolves, win/loss deterministic |
| XP/Level system | vitest | Boundary tests at level thresholds |
| Loot table | vitest + fast-check | Property: rarity distribution matches weights over N iterations |
| Streak tracker | vitest (fake timers) | Day boundaries, shield mechanics, reset logic |
| Ink components | vitest + ink-testing-library | Render output assertions, keyboard input simulation |
| CLI integration | vitest | Factory pattern for Commander, temp database for e2e |

### New Dev Dependencies

```
ink-testing-library
fast-check
@fast-check/vitest
@vitest/coverage-v8
```

### Coverage Targets

- `src/core/`: 90% line coverage (pure logic, fully testable)
- `src/data/`: 80% line coverage
- `src/components/`: 60% line coverage (UI rendering)
- Overall: 75%

---

## Non-Functional Requirements

### NFR-1: Performance
- Database queries < 10ms (SQLite in-process, indexed)
- Screen transitions < 50ms (React state update)
- No perceptible lag on key input

### NFR-2: Terminal Compatibility
- Works on: Windows Terminal, iTerm2, Kitty, Ghostty, standard macOS Terminal
- Graceful fallback if terminal doesn't support Unicode box drawing
- Respect `NO_COLOR` environment variable

### NFR-3: Data Safety
- All game state in `~/.realm-of-recall/game.db`
- SQLite WAL mode for crash resistance
- No data loss on unexpected exit (no in-memory-only state that isn't flushed)

### NFR-4: Accessibility
- All UI navigable via keyboard (no mouse required — it's a CLI)
- Color is never the only indicator of state (text labels accompany colors)
- Screen reader-friendly text output when not in fullscreen mode

---

## Out of Scope (v0.3.0+)

- Skill tree system
- Companion/pet creature
- Achievement system with badges
- Daily/weekly quest system
- Multiplayer leaderboards
- Anki deck import (.apkg)
- LLM-powered card generation
- Sound effects
