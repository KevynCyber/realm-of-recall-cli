# Changelog

## [0.5.0] - 2026-02-28

### Added

- **Diminishing-Cues Hints (US-002)**: Press [H] during review for progressive hints. 4 reveal levels (first letter → every 3rd → every other → full). Based on Fiechter & Benjamin (2017) research.
- **Cross-Deck Interleaving (US-003)**: Cards from multiple decks are mixed with a max-2-consecutive constraint. Research shows ~30% better retention (Bjork).
- **Achievement System (US-004)**: 24 achievements across 4 categories (Learning, Combat, Progression, Exploration). Tracked in SQLite with unlock timestamps. New Achievement screen in hub menu.
- **Ascension System (US-005)**: 10-level difficulty scaling with cumulative modifiers (hardened foes, time pressure, no mercy, brutal strikes, weakened start, scarce loot, no hints, venomous, precision required, nightmare).
- **Class Abilities (US-006)**: 9 abilities (3 per class) with SP costs and cooldowns. Scholar: Reveal/Insight/Wisdom Surge. Warrior: Endure/Battle Cry/Fortify. Rogue: Steal/Shadow Strike/Lucky Find.
- **Daily Challenge (US-007)**: Deterministic daily encounters seeded by date (Mulberry32 PRNG). Scoring based on accuracy (0-500), speed (0-300), and damage (0-200). 2x gold, 1.5x XP multipliers.
- **Random Events (US-008)**: 8 event types between dungeon floors (Treasure Room, Wandering Merchant, Mysterious Shrine, Card Blessing, Rest Camp, Cursed Chest, Wisdom Well, Streak Guardian). HP-weighted selection.
- **Dungeon Run (US-009)**: 5-floor gauntlet with scaling difficulty (1.0x→3.0x HP). Floor 5 is a boss. Rewards: completed=2x, defeated=0.5x, retreated=1x.
- **AchievementScreen**: Scrollable category-grouped achievement display with unlock status.
- **DailyChallengeScreen**: Shows daily enemy, score, and bonus multipliers.
- **DungeonRunScreen**: Multi-floor dungeon with random events between floors.
- **Hub Menu**: Added Dungeon Run, Daily Challenge, and Achievements to navigation.
- **Achievement Repository**: SQLite persistence for achievement unlocks.
- **Migration 005_perfect_game**: achievements table, player fields for ascension, skill points, daily challenges.
- 189 new tests (649 total across 34 test files)

## [0.4.0] - 2026-02-28

### Added

- **Confidence-Based Review (F-11)**: After answering correctly, rate your confidence (Lucky Guess / Knew It / Instant Recall). Confidence affects FSRS scheduling — guessed answers get shorter intervals even when correct.
- **Card Evolution System (F-12)**: Cards progress through 4 tiers (New → Learned → Proven → Mastered) based on consecutive correct answers and FSRS stability. Higher tiers grant combat damage multipliers (up to 2x) and crit bonuses (+25%).
- **Interleaved Retrieval Modes (F-13)**: Cards can now be reviewed in different modes — Standard, Reversed (show answer/guess question), Teach (explain concept + self-rate), and Connect. Weighted random selection with recency penalties ensures variety.
- **Post-Session Reflection (F-14)**: Kolb-inspired reflection after every combat and review session. Rate difficulty, optionally journal, and earn Wisdom XP (25 micro-reflection + 50 journal). RPG-themed prompts. Growth mindset reframing (CPJ) for sessions below 70% accuracy.
- **Marginal Gains Dashboard (F-15)**: Stats screen now shows ASCII sparkline trends for accuracy and speed, with trend direction indicators and percentage changes.
- **Wisdom XP**: New player stat tracking reflection engagement, persisted to database.
- **Card Health Indicators**: FlashcardFace shows evolution tier visuals (stars, border styles) and health warnings for struggling/leech cards.
- **ReflectionRepository**: Full persistence for session reflections with accuracy history for CPJ.
- **StatsRepository extensions**: Track confidence, retrieval mode, response text in attempts. Track evolution tier and gap streak per card. Per-day accuracy and speed history queries.
- **Migration 004_ultra_learner**: New columns on recall_attempts, recall_stats, player tables + session_reflections table.
- 131 new tests (460 total across 26 test files)

## [0.3.1] - 2026-02-28

### Added

- 122 UI component tests across 6 test files using ink-testing-library
  - `common.test.tsx` — ProgressBar (7 tests), SelectMenu (7 tests)
  - `combat.test.tsx` — DamageNumber, EnemyDisplay, CombatLog, LootDrop (21 tests)
  - `review.test.tsx` — FlashcardFace, ReviewSummary (14 tests)
  - `app.test.tsx` — ThemeProvider, Header, StatusBar (13 tests)
  - `screens.test.tsx` — HubScreen, StatsScreen, MapScreen, DeckScreen, InventoryScreen (44 tests)
  - `title-screen.test.tsx` — TitleScreen full flow (16 tests)
- Vitest config updated to include `.tsx` test files
- Overall test coverage raised from 42% to 67% (329 total tests)

## [0.3.0] - 2026-02-28

### Added

- Equipped Decks feature: toggle which decks are active for hub reviews and combat
- New Deck Management screen accessible from the hub menu ([7] Manage Decks)
- `equipped` column on decks table (defaults to equipped) with migration 003
- Multi-deck filtering in StatsRepository (getDueCards/getDueCardIds accept string[])
- CardRepository methods: `getEquippedDeckIds()`, `toggleDeckEquipped()`
- Prevents unequipping the last deck (must always have at least 1 equipped)
- Hub Adventure, Quick Review, and cards-due count now respect equipped deck selection
- Zone/Map combat continues to pull from zone-specific decks regardless of equipped status

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
