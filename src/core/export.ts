import type Database from "better-sqlite3";
import { CardRepository } from "../data/repositories/CardRepository.js";
import { StatsRepository } from "../data/repositories/StatsRepository.js";
import { PlayerRepository } from "../data/repositories/PlayerRepository.js";

export interface ExportedCard {
  front: string;
  back: string;
  acceptableAnswers: string[];
  type: string;
}

export interface ExportedDeck {
  name: string;
  description: string;
  cards: ExportedCard[];
}

export interface ExportedReviewStats {
  cardFront: string;
  deckName: string;
  totalAttempts: number;
  correctCount: number;
  consecutiveCorrect: number;
  bestStreak: number;
  difficulty: number;
  stability: number;
  repetitions: number;
  lapses: number;
  cardState: string;
  lastReviewAt: string | null;
  nextReviewAt: string | null;
}

export interface ExportedPlayer {
  name: string;
  class: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  gold: number;
  streakDays: number;
  longestStreak: number;
  totalReviews: number;
  totalCorrect: number;
  combatWins: number;
  combatLosses: number;
}

export interface ExportData {
  version: 1;
  exportedAt: string;
  decks: ExportedDeck[];
  reviewStats: ExportedReviewStats[];
  player: ExportedPlayer | null;
}

export function buildExportData(db: Database.Database): { data: ExportData; cardCount: number } {
  const cardRepo = new CardRepository(db);
  const statsRepo = new StatsRepository(db);
  const playerRepo = new PlayerRepository(db);

  const allDecks = cardRepo.getAllDecks();
  const exportedDecks: ExportedDeck[] = [];
  const reviewStats: ExportedReviewStats[] = [];
  let cardCount = 0;

  for (const deck of allDecks) {
    const cards = cardRepo.getCardsByDeck(deck.id);
    cardCount += cards.length;

    exportedDecks.push({
      name: deck.name,
      description: deck.description,
      cards: cards.map((c) => ({
        front: c.front,
        back: c.back,
        acceptableAnswers: c.acceptableAnswers,
        type: c.type,
      })),
    });

    for (const card of cards) {
      const schedule = statsRepo.getSchedule(card.id);
      if (schedule) {
        const statsRow = db
          .prepare(
            "SELECT total_attempts, correct_count, consecutive_correct, best_streak FROM recall_stats WHERE card_id = ?",
          )
          .get(card.id) as any;

        reviewStats.push({
          cardFront: card.front,
          deckName: deck.name,
          totalAttempts: statsRow?.total_attempts ?? 0,
          correctCount: statsRow?.correct_count ?? 0,
          consecutiveCorrect: statsRow?.consecutive_correct ?? 0,
          bestStreak: statsRow?.best_streak ?? 0,
          difficulty: schedule.difficulty,
          stability: schedule.stability,
          repetitions: schedule.reps,
          lapses: schedule.lapses,
          cardState: schedule.state,
          lastReviewAt: schedule.lastReview,
          nextReviewAt: schedule.due,
        });
      }
    }
  }

  const player = playerRepo.getPlayer();
  let exportedPlayer: ExportedPlayer | null = null;
  if (player) {
    exportedPlayer = {
      name: player.name,
      class: player.class,
      level: player.level,
      xp: player.xp,
      hp: player.hp,
      maxHp: player.maxHp,
      attack: player.attack,
      defense: player.defense,
      gold: player.gold,
      streakDays: player.streakDays,
      longestStreak: player.longestStreak,
      totalReviews: player.totalReviews,
      totalCorrect: player.totalCorrect,
      combatWins: player.combatWins,
      combatLosses: player.combatLosses,
    };
  }

  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    decks: exportedDecks,
    reviewStats,
    player: exportedPlayer,
  };

  return { data, cardCount };
}
