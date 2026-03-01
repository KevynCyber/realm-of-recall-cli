# Changelog

## [0.6.0] - 2026-03-01

### Learning Perfection Update

Comprehensive update fixing disconnected systems, adding research-backed learning science features, and introducing meta-progression. 518 new tests (1187 total across 64 test files).

### Fixed — Disconnected Systems (US-001 through US-005)

- **Card Evolution Tier Wiring (US-001)**: `evaluateEvolutionTier()` now called in review and combat flows. Cards visibly evolve through tiers (New/Learned/Proven/Mastered) with damage multipliers (1.0x/1.25x/1.5x/2.0x) applied in combat.
- **Card Health Status Wiring (US-002)**: `getCardHealth()` now computed from attempt history. FlashcardFace shows yellow warnings for struggling cards (3+ failures in last 5) and red warnings for leeches (5+ lapses).
- **Ascension Combat Settings (US-003)**: `applyAscensionToCombat()` now applied in combat preparation. Timer reduction, hint disabling, partial credit removal, starting HP reduction, and poison damage all functional per ascension level.
- **Retrieval Mode Selection (US-004)**: `selectMode()` from ModeSelector.ts now called for review and combat. Standard, Reversed, Teach, and Connect modes with weighted random selection and recency penalties. Connect mode grants 1.2x damage multiplier.
- **Dungeon Run Real Combat (US-005)**: Dungeon floors now use real card review via CombatScreen instead of `simulateFloorResult()`. Player HP persists across floors. Floor enemy HP scaled by floor config multiplier.

### Added — Learning Science Features (US-006 through US-017)

- **Configurable FSRS Retention (US-006)**: Set target retention rate (0.70-0.97) from Settings screen. Scheduler passes `desiredRetention` to ts-fsrs for personalized interval scheduling.
- **Max New Cards Per Day (US-007)**: Configurable daily limit on new cards (default 20). Prevents overwhelm after importing large decks. Remaining allowance shown in hub.
- **Successive Relearning (US-008)**: Wrong/timeout cards re-queued at end of session (max 2 retries per card). Re-queued cards show "Retry" indicator on FlashcardFace.
- **Card Suspend and Bury (US-009)**: Press [S] to suspend a card indefinitely, [B] to bury until tomorrow. Suspended/buried cards excluded from due queue. Manage from Deck screen.
- **Undo Last Answer (US-010)**: Press [U] during feedback phase to undo last answer. Reverts scheduling data and returns to question phase. Works in both review and combat.
- **Session Length Guardrails (US-011)**: Break suggestions after 15 minutes (subtle) and 25 minutes (prominent). Shows session duration, cards reviewed, and friendly message. Respects `REALM_NO_ANIMATION`.
- **Welcome Back Flow (US-012)**: Gentle re-engagement when returning with 50+ overdue cards. Three options: Quick Catch-Up (10 easiest), Normal Session (20 cards), Full Review (all overdue). Prioritizes highest-stability cards.
- **In-App Card Creation (US-013)**: Create flashcards directly in the app via "Create Cards" hub option. Supports front/back and cloze deletion syntax. Generation effect improves retention of self-authored cards.
- **Configurable Answer Timer (US-014)**: Adjust timer (15s/20s/30s/45s/60s/Off) from Settings. Timer 0 disables timeout entirely. Ascension modifiers reduce the configured timer, not a hardcoded value.
- **Data Export (US-015)**: `ror export [directory]` CLI command exports all decks, cards, and review statistics to a dated JSON file. Compatible with `ror import`.
- **Wisdom XP Perks (US-016)**: 5 perks unlocked by accumulated wisdom XP: Extra Hint Level (100), Study Shield (250), Quick Learner (500, 1.1x starting stability), Deep Focus (750, +10% review XP), Sage's Insight (1000). Displayed in Stats screen.
- **Elaborative Interrogation (US-017)**: 30% chance of "Why is this true?" prompt after correct answers on evolved cards (tier >= 1). Typed explanations earn 15 bonus Wisdom XP. Based on Dunlosky et al. (2013).

### Added — Research-Backed Improvements (US-018 through US-030)

- **Delayed Retention Rewards (US-018)**: 3x XP/gold for recalls after 7-29 days, 5x for 30+ days. Aligns rewards with the spacing effect. Bonus shown in ReviewSummary.
- **Streak Decay Model (US-019)**: Missed days reduce streak by min(5, floor(streak/4)) instead of hard reset. Earn-back recovers half the deducted days on return. Reduces binge-quit behavior.
- **Idle Progression (US-020)**: Earn 30 gold/hour (capped at 8 hours, 240 max) and recover 10% max HP/hour while away. "Welcome back" banner on hub.
- **Encounter Preview (US-021)**: See enemy name, tier, HP, difficulty, and reward range before committing to combat. Retreat to hub with no penalty (except during dungeon runs).
- **Equipment Special Effects (US-022)**: Equipment `specialEffect` strings now parsed and applied in combat. Bonus damage on Perfect, healing on Correct, double crit damage, gold multiplier. Activations shown in CombatLog.
- **Rare Card Variants — Schema & Logic (US-023)**: Cards can earn foil (4%), golden (0.9%), or prismatic (0.1%) variants on Perfect answers after 5+ consecutive correct. Variable-ratio reward schedule.
- **Rare Card Variants — UI (US-024)**: Foil (cyan/sparkle), golden (yellow/star), prismatic (magenta/diamond) visual treatments on FlashcardFace. "NEW VARIANT!" notifications. Collection counts in Stats screen.
- **Bestiary Schema (US-025)**: `enemy_encounters` table tracking defeated enemies with encounter counts and timestamps. EnemyRepository with upsert logic.
- **Bestiary & Collection Screen (US-026)**: Two-tab gallery: Enemies tab (grouped by tier, unencountered shown as "???") and Collection tab (per-deck mastery progress bars). Accessible from hub menu.
- **Narrative Lore on Defeat (US-027)**: 20 lore fragments revealed on combat defeat, matched by enemy tier. Hades-inspired "every run is meaningful" design. Shows cards reviewed count to reframe defeat as progress.
- **Terminal Title Bar (US-028)**: Terminal title updates on screen transitions ("Realm of Recall - Combat vs [enemy]"). BEL notifications on achievements, streak milestones, variant drops, dungeon completion.
- **Meta-Progression Unlocks — Schema (US-029)**: 8 permanent unlocks earned through ascension: Reversed Mode (A1), Teach Mode (A2), Connect Mode (A3), Prismatic Variants (A4), Extended Dungeon (A5), Nightmare Enemies (A7), Master Title (A10). Persisted via `unlocks` table.
- **Meta-Progression Unlocks — Enforcement (US-030)**: Retrieval modes, prismatic variants, and extended dungeon gated behind ascension unlocks. "New Unlock!" notification on hub. Meta-Progression display in UI.

## [0.5.1] - 2026-02-28

### Added

- **Cross-Deck Interleaving in Combat (US-011)**: Hub Adventure now interleaves cards from all equipped decks using max-2-consecutive constraint for optimal retention.
- **Ascension UI in World Map (US-013)**: View current ascension level and active modifiers on the map. Press [A] to begin next ascension when all zones are cleared.
- **Class Abilities in Combat (US-014)**: Press [A] during combat to open ability menu. SP display, cooldown tracking, and 9 class abilities (Reveal, Insight, Wisdom Surge, Endure, Battle Cry, Fortify, Steal, Shadow Strike, Lucky Find).
- **Post-Combat Random Events (US-016)**: 30% chance of a random event after combat victories. 8 event types with choices and outcomes that affect gold, HP, XP, and more.
- **Enhanced Card Health Visualization (US-018)**: FlashcardFace now shows evolution tier progress bar, tier names (New/Learned/Proven/Mastered), and narrative guidance for struggling and leech cards.
- **Terminal Effects (US-019)**: BEL audio on level up and achievement unlock. ASCII art LEVEL UP banner. Text reveal animation support. Disable with `REALM_NO_ANIMATION=1`.
- **RandomEventScreen**: Standalone screen for post-combat random events with choice UI and outcome display.
- **TerminalEffects module**: `playBel()`, `LEVEL_UP_ART`, `revealText()`, `animationsEnabled()`.
- **Ascension modifiers applied to combat enemies**: Enemy HP and attack scale with ascension level.
- 20 new tests (669 total across 36 test files)

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
