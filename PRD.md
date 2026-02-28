# Realm of Recall CLI — Product Requirements Document

**Version**: 0.4.0 — The Ultra-Learner Update
**Date**: 2026-02-28
**Source**: iCanStudy Academic Program v2 — "The Ultra-Learner's Playbook"

## Executive Summary

v0.4.0 integrates evidence-based learning science from the iCanStudy Academic Program into Realm of Recall's existing RPG mechanics. Five new features add depth to the learning loop: confidence-based assessment, card evolution, interleaved retrieval modes, post-battle reflection, and marginal gains tracking. Each maps to an RPG mechanic that makes the game more engaging while genuinely improving learning outcomes.

---

## Architecture Decisions (v0.4.0)

### AD-8: Confidence Maps to FSRS Ratings

**Decision**: Confidence level modifies the FSRS rating, not stored as a separate scheduling dimension.
**Rationale**: FSRS was designed for exactly this: `Guess → Hard`, `Knew → Good`, `Instant → Easy`. This is the simplest correct approach — no need for a second scheduler or custom algorithm. Knowledge gaps (correct + low confidence) naturally get shorter intervals through Hard rating.

### AD-9: Evolution Parallel to FSRS

**Decision**: Card evolution tiers read from FSRS data (stability, lapses, state) but don't write back to the scheduling algorithm.
**Rationale**: Evolution is a gamification layer that provides combat bonuses. Keeping it separate from FSRS means the scientifically-validated scheduling is never distorted by game mechanics. Evolution tier is stored as a simple integer on `recall_stats`.

### AD-10: Self-Rating for Teach/Connect Modes

**Decision**: No NLP auto-grading for Teach and Connect modes. Users self-rate their explanations.
**Rationale**: Self-rating IS the learning exercise (metacognitive monitoring). Research shows metacognitive calibration is itself a trainable, valuable skill. This is both simpler to implement and pedagogically superior to auto-grading.

### AD-11: Reflection Is Optional

**Decision**: Micro-reflection is always shown but can be dismissed instantly. Journal prompts appear 30% of the time and can be skipped with Esc.
**Rationale**: Forced journaling breeds resentment. Only incentivize with small XP bonus. The micro-reflection (single keystroke) is low enough friction to show every time.

---

## Feature F-11: Confidence Rating System

**Learning science**: Confidence-based assessment detects knowledge gaps (correct but uncertain) and misconceptions (wrong but confident). A lucky guess is still a gap.

**RPG mechanic**: After answering correctly, rate confidence. Affects FSRS scheduling AND combat damage.

### Specification

**New enum — `ConfidenceLevel`**:
- `Guess` — "Lucky guess" (correct but uncertain)
- `Knew` — "Knew it" (normal confidence)
- `Instant` — "Instant recall" (total certainty)

**Combined mapping (replaces simple `QUALITY_TO_RATING`)**:

| Answer Quality | Confidence | FSRS Rating | Combat Damage |
|---|---|---|---|
| Perfect | Instant | Easy | 2.5x (crit possible) |
| Perfect | Knew | Good | 2.0x |
| Perfect | Guess | Hard | 1.0x (knowledge gap) |
| Correct | Instant | Easy | 1.5x |
| Correct | Knew | Good | 1.0x |
| Correct | Guess | Hard | 0.5x (knowledge gap) |
| Partial | any | Hard | 0.5x |
| Wrong | any | Again | Enemy attacks |
| Timeout | any | Again | Enemy attacks + poison |

**UX flow**: After correct/perfect answer, single keystroke prompt `[1] Lucky guess [2] Knew it [3] Instant recall`. Wrong/timeout answers skip the prompt.

**Knowledge gap tracking**: Cards with 3+ consecutive `Guess` ratings are flagged as knowledge gaps, get priority in scheduling.

### Data Changes

```sql
ALTER TABLE recall_attempts ADD COLUMN confidence TEXT;
ALTER TABLE recall_stats ADD COLUMN gap_streak INTEGER NOT NULL DEFAULT 0;
```

Extend `RecallAttempt` with optional `confidence?: ConfidenceLevel`.
Extend `CardStats` with `gapStreak: number`.

### Files

- Modify: `src/types/index.ts` (add ConfidenceLevel enum, extend interfaces)
- Modify: `src/core/spaced-repetition/Scheduler.ts` (new `getEffectiveRating(quality, confidence)`)
- Modify: `src/core/combat/CombatEngine.ts` (confidence-based damage multipliers)
- Modify: `src/components/review/ReviewScreen.tsx` (add confidence prompt after correct answers)
- Modify: `src/data/repositories/StatsRepository.ts` (gap_streak tracking)

---

## Feature F-12: Card Evolution System (Rule of 3)

**Learning science**: 3 correct in a row → card is known (combine/cut). 3 wrong out of 5 → encoding is bad (go deeper). Anki's leech detection is similar but triggers too late.

**RPG mechanic**: Cards evolve through tiers with visual upgrades and combat bonuses.

### Specification

**Evolution tiers**:

| Tier | Name | Trigger | Visual | Combat Bonus |
|---|---|---|---|---|
| 0 | New | Default state | Dim border | None |
| 1 | Learned | 3 consecutive correct + state != "new" | Cyan border, 1 star | +25% damage |
| 2 | Proven | 3 consecutive correct at Good+ AND stability >= 10 | Gold border, 2 stars | +50% damage, +10% crit |
| 3 | Mastered | 3 consecutive correct at Good+ AND stability >= 30 AND 0 lapses since tier 2 | Purple border, 3 stars | +100% damage, +25% crit |

- Tiers never regress. A lapsed Mastered card enters relearning but keeps its tier visually with a "cracked" indicator until re-proven (3 consecutive correct again).
- The `consecutive_correct` count in `recall_stats` already exists and tracks this.

**Card health system**:

| Status | Trigger | Effect |
|---|---|---|
| Healthy | Default | Normal |
| Struggling | 3 wrong out of last 5 attempts | Yellow warning, "This card needs deeper study" |
| Leech | 5+ total lapses | Red warning, suspended from combat |

### Data Changes

```sql
ALTER TABLE recall_stats ADD COLUMN evolution_tier INTEGER NOT NULL DEFAULT 0;
```

### Files

- Create: `src/core/cards/CardEvolution.ts` (tier evaluation, card health assessment — pure functions)
- Create: `tests/core/CardEvolution.test.ts`
- Modify: `src/core/combat/CombatEngine.ts` (tier-based damage multipliers)
- Modify: `src/components/review/FlashcardFace.tsx` (tier-based visual styling)

---

## Feature F-13: Interleaved Retrieval Modes (Battle Styles)

**Learning science**: Interleaving retrieval format compounds the spacing effect. Varying how you recall creates multiple memory pathways. Free recall > cued recall > recognition.

**RPG mechanic**: 4 "Battle Styles" with different combat properties. System selects styles to force variety.

### Specification

**Modes**:

| Mode | RPG Name | How It Works | Damage Mult |
|---|---|---|---|
| Standard | Quick Strike | Type the answer (current Q&A) | 1.0x |
| Reversed | Parry | Show answer, type the question/term | 1.1x |
| Teach | Scholar's Lecture | Show front, explain freely, self-rate 1-4 | 1.5x |
| Connect | Combo Attack | Show 2 card fronts, explain relationship, self-rate 1-3 | 1.2x per card |

**Mode selection algorithm**:
- New/relearning cards → always Standard
- Learning cards → Standard or Reversed only
- Review cards → weighted random (Standard=40, Reversed=25, Teach=20, Connect=15)
- Recency penalty: reduce weight if mode was used recently for this card
- Session rule: if 3+ cards used the same mode, force a switch

**Teach mode UX**:
1. Show card front + "Explain this concept:"
2. Free-text input
3. Show correct answer as reference
4. Self-rate: [1] Nailed it→Perfect, [2] Decent→Correct, [3] Weak→Partial, [4] Wrong→Wrong

**Connect mode UX**:
1. Show two card fronts
2. "How do these relate?" + free-text input
3. Show both answers
4. Self-rate: [1] Strong→Correct, [2] Partial→Partial, [3] Missed→Wrong
5. Both cards get scheduling update

**Reversed mode**: Swap front/back. Use `evaluateAnswer` with card front as target.

### Data Changes

```sql
ALTER TABLE recall_attempts ADD COLUMN retrieval_mode TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE recall_attempts ADD COLUMN response_text TEXT;
```

### Files

- Create: `src/core/review/ModeSelector.ts` (weighted selection, recency penalty — pure functions)
- Create: `tests/core/ModeSelector.test.ts`
- Modify: `src/types/index.ts` (add RetrievalMode enum, extend RecallAttempt)
- Modify: `src/components/review/ReviewScreen.tsx` (mode-aware rendering)
- Modify: `src/data/repositories/StatsRepository.ts` (store/query retrieval_mode)

---

## Feature F-14: Post-Battle Reflection (Kolb's Cycle)

**Learning science**: Kolb's Cycle (Experience→Reflection→Abstraction→Experimentation) is the most powerful metacognitive technique. Brief structured reflection after sessions dramatically improves retention.

**RPG mechanic**: "Post-Battle Meditation" awards Wisdom XP.

### Specification

**Micro-reflection (every session, ~5 seconds)**:
```
How did that battle feel?
[1] Crushing defeat (I was guessing)
[2] Hard-fought (I had to think)
[3] Effortless (too easy)
```
Single keystroke. Awards +25 Wisdom XP.

**Battle journal (30% of sessions, optional)**:
Random prompt from a pool of 15+, rotated, never repeat consecutively:
- "Which card caught you off guard? Why?"
- "If you had to teach one thing from this battle, what would it be?"
- "What tactic will you try next time?"
- "What mistake taught you the most today?"
- "How does your recall compare to yesterday?"
- etc.

Free-text, max ~200 chars. Awards +50 Wisdom XP. Skippable with Esc.

**Growth mindset reframes** (on sessions with accuracy <70%):
One contextual CPJ message after low-accuracy sessions:
- Acknowledge factually: "Tough battle — X% accuracy."
- Process reframe: "Every missed card is now primed for stronger memory."
- Journey context: "Your first session was Y%. You're improving."

**Wisdom XP**: New player stat, accumulated through reflections. Visible in stats. Does NOT affect combat — it's a metacognitive growth metric.

### Data Changes

```sql
CREATE TABLE session_reflections (
  id TEXT PRIMARY KEY,
  session_type TEXT NOT NULL CHECK(session_type IN ('combat', 'review')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  difficulty_rating INTEGER NOT NULL CHECK(difficulty_rating BETWEEN 1 AND 3),
  journal_entry TEXT,
  prompt_used TEXT,
  accuracy REAL NOT NULL,
  cards_reviewed INTEGER NOT NULL,
  deck_id TEXT,
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE SET NULL
);
CREATE INDEX idx_reflections_date ON session_reflections(created_at);

ALTER TABLE player ADD COLUMN wisdom_xp INTEGER NOT NULL DEFAULT 0;
```

### Files

- Create: `src/core/reflection/ReflectionEngine.ts` (prompt selection, CPJ reframes, Wisdom XP calc)
- Create: `src/components/review/ReflectionScreen.tsx` (micro-reflection + journal UI)
- Create: `src/data/repositories/ReflectionRepository.ts` (CRUD for session_reflections)
- Create: `tests/core/ReflectionEngine.test.ts`
- Create: `tests/data/ReflectionRepository.test.ts`
- Modify: `src/components/screens/CombatScreen.tsx` (show reflection after combat)
- Modify: `src/data/database.ts` (migration 004)

---

## Feature F-15: Marginal Gains Dashboard

**Learning science**: "Your brain cannot detect gradual improvement. Without tracking, you spiral into demotivation and quit." Compare only to your own past. Track compound growth.

**RPG mechanic**: Enhanced Stats screen with sparkline trends.

### Specification

**Metrics** (7-day rolling window):

| Metric | Visualization | What It Shows |
|---|---|---|
| Accuracy trend | ASCII sparkline (▁▂▃▄▅▆▇█) | % correct over last 7 sessions |
| Response speed | ASCII sparkline | Median response time trend |
| Mastery depth | Horizontal bar | % of cards at each evolution tier |
| Consistency | Dot grid (14 days) | Days active in last 2 weeks |
| Confidence calibration | Percentage | Self-rated confidence vs actual accuracy |
| Cards mastered | Count + delta | Cards at tier 2+, with weekly change |

**Compound growth projection**: "At this pace, in 30 more days: ~X cards mastered"

### Data Changes

No new tables — computed from existing `recall_attempts`, `recall_stats`, and `session_reflections`.

### Files

- Create: `src/core/analytics/MarginalGains.ts` (trend calc, sparkline generation — pure functions)
- Create: `tests/core/MarginalGains.test.ts`
- Modify: `src/components/screens/StatsScreen.tsx` (add dashboard sections)

---

## Database Migration: 004_ultra_learner

```sql
-- Confidence tracking
ALTER TABLE recall_attempts ADD COLUMN confidence TEXT;
ALTER TABLE recall_attempts ADD COLUMN retrieval_mode TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE recall_attempts ADD COLUMN response_text TEXT;

-- Card evolution
ALTER TABLE recall_stats ADD COLUMN evolution_tier INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recall_stats ADD COLUMN gap_streak INTEGER NOT NULL DEFAULT 0;

-- Player wisdom
ALTER TABLE player ADD COLUMN wisdom_xp INTEGER NOT NULL DEFAULT 0;

-- Session reflections
CREATE TABLE session_reflections (
  id TEXT PRIMARY KEY,
  session_type TEXT NOT NULL CHECK(session_type IN ('combat', 'review')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  difficulty_rating INTEGER NOT NULL CHECK(difficulty_rating BETWEEN 1 AND 3),
  journal_entry TEXT,
  prompt_used TEXT,
  accuracy REAL NOT NULL,
  cards_reviewed INTEGER NOT NULL,
  deck_id TEXT,
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE SET NULL
);

CREATE INDEX idx_reflections_date ON session_reflections(created_at);
```

---

## Testing Strategy (v0.4.0)

| Feature | Test File | Key Cases |
|---|---|---|
| Confidence | `tests/core/ConfidenceRating.test.ts` | FSRS rating mapping, gap streak tracking, knowledge gap detection |
| Evolution | `tests/core/CardEvolution.test.ts` | Tier thresholds, no regression, struggling/leech detection |
| Mode Selector | `tests/core/ModeSelector.test.ts` | Weight distribution, recency penalty, new cards always Standard |
| Reflection | `tests/core/ReflectionEngine.test.ts` | Prompt rotation, CPJ trigger, Wisdom XP |
| Marginal Gains | `tests/core/MarginalGains.test.ts` | Sparkline generation, trend calc, calibration |
| Reflection Repo | `tests/data/ReflectionRepository.test.ts` | CRUD, migration 004 |
| Scheduler update | Update `tests/core/Scheduler.test.ts` | `getEffectiveRating` with confidence |
| Combat update | Update `tests/core/CombatEngine.test.ts` | Tier/confidence damage multipliers |

---

## Non-Functional Requirements (v0.4.0)

- All new core logic in `src/core/` as pure functions — no I/O, no UI
- All functions using randomness accept optional `rng` parameter
- No new runtime dependencies
- Backward compatible — existing saves work after migration 004
- Combat UX stays fast — confidence prompt is single keystroke, no Enter
- Existing tests must continue passing
