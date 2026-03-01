import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useGameTheme } from "../app/ThemeProvider.js";
import type { Player } from "../../types/player.js";
import { xpToNextLevel } from "../../core/progression/XPCalculator.js";
import { getStreakBonus, getStreakTitle } from "../../core/progression/StreakTracker.js";
import type { TrendResult } from "../../core/analytics/MarginalGains.js";
import { getUnlockedPerks, WISDOM_PERKS } from "../../core/progression/WisdomPerks.js";
import { getAllUnlocks } from "../../core/progression/MetaUnlocks.js";
import type { MetaUnlock } from "../../core/progression/MetaUnlocks.js";

interface DeckStat {
  name: string;
  total: number;
  mastered: number;
  accuracy: number;
}

interface FsrsStats {
  newCount: number;
  learningCount: number;
  reviewCount: number;
  relearnCount: number;
}

/** Valid desired retention presets */
const RETENTION_PRESETS = [0.70, 0.75, 0.80, 0.85, 0.90, 0.92, 0.95, 0.97] as const;

/** Valid max new cards per day presets */
const NEW_CARDS_PRESETS = [5, 10, 15, 20, 30, 50, 100, 9999] as const;

/** Valid answer timer presets (0 = disabled) */
const TIMER_PRESETS = [15, 20, 30, 45, 60, 0] as const;

interface VariantCounts {
  foil: number;
  golden: number;
  prismatic: number;
}

interface Props {
  player: Player;
  deckStats: DeckStat[];
  fsrsStats: FsrsStats;
  onBack: () => void;
  onUpdateRetention?: (retention: number) => void;
  onUpdateMaxNewCards?: (maxNewCards: number) => void;
  onUpdateTimer?: (timerSeconds: number) => void;
  // Ultra-learner props (all optional for backward compat)
  accuracyTrend?: TrendResult;
  speedTrend?: TrendResult;
  consistencyGrid?: string;
  wisdomXp?: number;
  variantCounts?: VariantCounts;
  unlockedKeys?: Set<string>;
}

function XPProgressBar({ xp, xpNeeded, color }: { xp: number; xpNeeded: number; color: string }) {
  const barWidth = 20;
  const filled = xpNeeded > 0 ? Math.min(barWidth, Math.round((xp / xpNeeded) * barWidth)) : 0;
  const empty = barWidth - filled;

  return (
    <Text>
      <Text color={color}>{"[" + "=".repeat(filled) + " ".repeat(empty) + "]"}</Text>
      <Text color={color}> {xp}/{xpNeeded} XP</Text>
    </Text>
  );
}

export function StatsScreen({
  player,
  deckStats,
  fsrsStats,
  onBack,
  onUpdateRetention,
  onUpdateMaxNewCards,
  onUpdateTimer,
  accuracyTrend,
  speedTrend,
  consistencyGrid,
  wisdomXp,
  variantCounts,
  unlockedKeys,
}: Props) {
  const theme = useGameTheme();
  const [settingsTab, setSettingsTab] = useState<"retention" | "newcards" | "timer">("retention");

  useInput((input, key) => {
    if (key.escape || input === "b") {
      onBack();
      return;
    }

    // Switch settings tab
    if (input === "r" && (onUpdateRetention || onUpdateMaxNewCards || onUpdateTimer)) {
      setSettingsTab("retention");
      return;
    }
    if (input === "n" && (onUpdateRetention || onUpdateMaxNewCards || onUpdateTimer)) {
      setSettingsTab("newcards");
      return;
    }
    if (input === "t" && (onUpdateRetention || onUpdateMaxNewCards || onUpdateTimer)) {
      setSettingsTab("timer");
      return;
    }

    const num = parseInt(input, 10);
    if (settingsTab === "timer" && onUpdateTimer && num >= 1 && num <= TIMER_PRESETS.length) {
      const newTimer = TIMER_PRESETS[num - 1];
      if (newTimer !== player.timerSeconds) {
        onUpdateTimer(newTimer);
      }
    } else if (num >= 1 && num <= 8) {
      if (settingsTab === "retention" && onUpdateRetention) {
        const newRetention = RETENTION_PRESETS[num - 1];
        if (newRetention !== player.desiredRetention) {
          onUpdateRetention(newRetention);
        }
      } else if (settingsTab === "newcards" && onUpdateMaxNewCards) {
        const newMax = NEW_CARDS_PRESETS[num - 1];
        if (newMax !== player.maxNewCardsPerDay) {
          onUpdateMaxNewCards(newMax);
        }
      }
    }
  });

  const xpNeeded = xpToNextLevel(player.level);
  const totalCombats = player.combatWins + player.combatLosses;
  const winRate = totalCombats > 0 ? Math.round((player.combatWins / totalCombats) * 100) : 0;
  const accuracy =
    player.totalReviews > 0
      ? Math.round((player.totalCorrect / player.totalReviews) * 100)
      : 0;
  const streakBonus = getStreakBonus(player.streakDays);
  const streakTitle = getStreakTitle(player.streakDays);

  const trendArrow = (trend: string) =>
    trend === "improving" ? "\u2191" : trend === "declining" ? "\u2193" : "\u2192";

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor={theme.colors.rare} paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.rare}>
          Player Statistics
        </Text>
      </Box>

      {/* Section 1 — Player Info */}
      <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.gold}>
          {player.name} the {player.class}
        </Text>
        <Text>Level {player.level}</Text>
        <XPProgressBar xp={player.xp} xpNeeded={xpNeeded} color={theme.colors.xp} />
      </Box>

      {/* Section 2 — Combat Record */}
      <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.damage}>
          Combat Record
        </Text>
        <Text>
          Wins: <Text color={theme.colors.success}>{player.combatWins}</Text>
          {"  "}Losses: <Text color={theme.colors.error}>{player.combatLosses}</Text>
          {"  "}Win Rate: <Text bold>{winRate}%</Text>
        </Text>
      </Box>

      {/* Section 3 — Study Stats */}
      <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.xp}>
          Study Stats
        </Text>
        <Text>Total Reviews: {player.totalReviews}</Text>
        <Text>Accuracy: {accuracy}%</Text>
        <Text>
          New: <Text color={theme.colors.mana}>{fsrsStats.newCount}</Text>
          {"  "}Learning: <Text color={theme.colors.warning}>{fsrsStats.learningCount}</Text>
          {"  "}Review: <Text color={theme.colors.success}>{fsrsStats.reviewCount}</Text>
          {"  "}Relearning: <Text color={theme.colors.error}>{fsrsStats.relearnCount}</Text>
        </Text>
      </Box>

      {/* Section 4 — Streaks */}
      <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.streakFire}>
          Streaks
        </Text>
        <Text>
          Current Streak: <Text color={theme.colors.streakFire}>{player.streakDays} days</Text>
          {player.streakDays > 0 ? <Text> {"\uD83D\uDD25"}</Text> : null}
        </Text>
        <Text>Longest Streak: {player.longestStreak} days</Text>
        <Text>
          Streak Bonus: <Text color={theme.colors.xp}>+{streakBonus}% XP</Text>
        </Text>
        <Text>
          Title: <Text bold>{streakTitle}</Text>
        </Text>
      </Box>

      {/* Section 5 — Deck Breakdown */}
      <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
        <Text bold color={theme.colors.mana}>
          Deck Breakdown
        </Text>
        {deckStats.length === 0 ? (
          <Text color={theme.colors.muted}>No decks imported yet.</Text>
        ) : (
          deckStats.map((deck) => (
            <Text key={deck.name}>
              {deck.name}: {deck.mastered}/{deck.total} mastered ({deck.accuracy}%)
            </Text>
          ))
        )}
      </Box>

      {/* Section 6 — Collection (Rare Variants) */}
      {variantCounts && (
        <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
          <Text bold color={theme.colors.rare}>
            Collection
          </Text>
          <Text>
            <Text color="cyan">{"\u2726"} {variantCounts.foil} Foil</Text>
            <Text>{" | "}</Text>
            <Text color="yellow">{"\u2605"} {variantCounts.golden} Golden</Text>
            <Text>{" | "}</Text>
            <Text color="magenta">{"\u25C6"} {variantCounts.prismatic} Prismatic</Text>
          </Text>
        </Box>
      )}

      {/* Section 7 — Progress Trends (Ultra-Learner) */}
      {accuracyTrend && (
        <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
          <Text bold color={theme.colors.xp}>
            Progress Trends
          </Text>
          <Text>
            Accuracy: {accuracyTrend.sparkline} {trendArrow(accuracyTrend.trend)}{" "}
            {Math.abs(accuracyTrend.percentChange).toFixed(1)}%
          </Text>
          {speedTrend && (
            <Text>
              Speed:    {speedTrend.sparkline} {trendArrow(speedTrend.trend)}{" "}
              {Math.abs(speedTrend.percentChange).toFixed(1)}%
            </Text>
          )}
        </Box>
      )}

      {/* Section 7 — Consistency (Ultra-Learner) */}
      {consistencyGrid && (
        <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
          <Text bold color={theme.colors.streakFire}>
            Consistency
          </Text>
          <Text>{consistencyGrid}</Text>
        </Box>
      )}

      {/* Section 8 — Wisdom (Ultra-Learner) */}
      {wisdomXp !== undefined && wisdomXp > 0 && (
        <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
          <Text bold color="magenta">
            Wisdom
          </Text>
          <Text>
            Wisdom XP: <Text color="magenta">{wisdomXp}</Text>
          </Text>
          {(() => {
            const unlocked = getUnlockedPerks(wisdomXp);
            if (unlocked.length === 0) {
              const next = WISDOM_PERKS[0];
              return (
                <Text color={theme.colors.muted}>
                  Next perk: {next.name} at {next.threshold} WXP
                </Text>
              );
            }
            return (
              <>
                <Text bold color="magenta">Perks:</Text>
                {unlocked.map((perk) => (
                  <Text key={perk.id}>
                    <Text color={theme.colors.success}>{"\u2713"}</Text> {perk.name} — {perk.description}
                  </Text>
                ))}
                {unlocked.length < WISDOM_PERKS.length && (
                  <Text color={theme.colors.muted}>
                    Next: {WISDOM_PERKS[unlocked.length].name} at {WISDOM_PERKS[unlocked.length].threshold} WXP
                  </Text>
                )}
              </>
            );
          })()}
        </Box>
      )}

      {/* Section — Meta-Progression */}
      {unlockedKeys !== undefined && (
        <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
          <Text bold color={theme.colors.rare}>
            Meta-Progression
          </Text>
          {getAllUnlocks().map((unlock: MetaUnlock) => {
            const isUnlocked = unlockedKeys.has(unlock.key);
            return (
              <Text key={unlock.key}>
                <Text color={isUnlocked ? theme.colors.success : theme.colors.muted}>
                  {isUnlocked ? "\u2713" : "\u2717"} {unlock.name}
                </Text>
                <Text color={theme.colors.muted}>
                  {" "}(Ascension {unlock.requiredAscension})
                </Text>
              </Text>
            );
          })}
        </Box>
      )}

      {/* Section 9 — Settings */}
      {(onUpdateRetention || onUpdateMaxNewCards || onUpdateTimer) && (
        <Box borderStyle="single" borderColor={theme.colors.muted} flexDirection="column" paddingX={1} marginBottom={1}>
          <Box marginBottom={1}>
            <Text bold={settingsTab === "retention"} color={settingsTab === "retention" ? theme.colors.rare : theme.colors.muted}>
              [R] Retention
            </Text>
            <Text>{"  "}</Text>
            <Text bold={settingsTab === "newcards"} color={settingsTab === "newcards" ? theme.colors.rare : theme.colors.muted}>
              [N] New Cards/Day
            </Text>
            <Text>{"  "}</Text>
            <Text bold={settingsTab === "timer"} color={settingsTab === "timer" ? theme.colors.rare : theme.colors.muted}>
              [T] Timer
            </Text>
          </Box>

          {settingsTab === "retention" && onUpdateRetention && (
            <>
              <Text bold color={theme.colors.rare}>
                Settings: Desired Retention
              </Text>
              <Text color={theme.colors.muted}>
                Higher = more frequent reviews, stronger memory. Lower = fewer reviews, more forgetting.
              </Text>
              <Text>
                Current: <Text bold color={theme.colors.success}>{(player.desiredRetention * 100).toFixed(0)}%</Text>
              </Text>
              <Box marginTop={1} flexDirection="column">
                {RETENTION_PRESETS.map((preset, i) => {
                  const isActive = preset === player.desiredRetention;
                  return (
                    <Text key={preset}>
                      <Text bold={isActive} color={isActive ? theme.colors.success : undefined}>
                        {isActive ? "> " : "  "}[{i + 1}] {(preset * 100).toFixed(0)}%
                        {preset === 0.90 ? " (default)" : ""}
                        {isActive ? " *" : ""}
                      </Text>
                    </Text>
                  );
                })}
              </Box>
            </>
          )}

          {settingsTab === "newcards" && onUpdateMaxNewCards && (
            <>
              <Text bold color={theme.colors.rare}>
                Settings: Max New Cards Per Day
              </Text>
              <Text color={theme.colors.muted}>
                Limits how many never-seen cards are introduced each day. Review cards are always shown.
              </Text>
              <Text>
                Current: <Text bold color={theme.colors.success}>{player.maxNewCardsPerDay === 9999 ? "Unlimited" : player.maxNewCardsPerDay}</Text>
              </Text>
              <Box marginTop={1} flexDirection="column">
                {NEW_CARDS_PRESETS.map((preset, i) => {
                  const isActive = preset === player.maxNewCardsPerDay;
                  const label = preset === 9999 ? "Unlimited" : `${preset}`;
                  return (
                    <Text key={preset}>
                      <Text bold={isActive} color={isActive ? theme.colors.success : undefined}>
                        {isActive ? "> " : "  "}[{i + 1}] {label}
                        {preset === 20 ? " (default)" : ""}
                        {isActive ? " *" : ""}
                      </Text>
                    </Text>
                  );
                })}
              </Box>
            </>
          )}

          {settingsTab === "timer" && onUpdateTimer && (
            <>
              <Text bold color={theme.colors.rare}>
                Settings: Answer Timer
              </Text>
              <Text color={theme.colors.muted}>
                Time allowed per card. Off disables the timer entirely (accessibility).
              </Text>
              <Text>
                Current: <Text bold color={theme.colors.success}>{player.timerSeconds === 0 ? "Off" : `${player.timerSeconds}s`}</Text>
              </Text>
              <Box marginTop={1} flexDirection="column">
                {TIMER_PRESETS.map((preset, i) => {
                  const isActive = preset === player.timerSeconds;
                  const label = preset === 0 ? "Off" : `${preset}s`;
                  return (
                    <Text key={preset}>
                      <Text bold={isActive} color={isActive ? theme.colors.success : undefined}>
                        {isActive ? "> " : "  "}[{i + 1}] {label}
                        {preset === 30 ? " (default)" : ""}
                        {isActive ? " *" : ""}
                      </Text>
                    </Text>
                  );
                })}
              </Box>
            </>
          )}
        </Box>
      )}

      {/* Navigation hint */}
      <Box paddingX={1}>
        <Text color={theme.colors.muted}>
          Press <Text bold>Esc</Text> or <Text bold>b</Text> to go back
          {(onUpdateRetention || onUpdateMaxNewCards || onUpdateTimer) ? (
            <Text>{" | "}<Text bold>{settingsTab === "timer" ? `1-${TIMER_PRESETS.length}` : "1-8"}</Text> to change setting{" | "}<Text bold>R/N/T</Text> to switch tab</Text>
          ) : null}
        </Text>
      </Box>
    </Box>
  );
}
