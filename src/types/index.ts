// Card types
export enum CardType {
  Basic = "basic",
  MultipleChoice = "multiple_choice",
  ClozeDeletion = "cloze_deletion",
}

export enum AnswerQuality {
  Perfect = "perfect",
  Correct = "correct",
  Partial = "partial",
  Wrong = "wrong",
  Timeout = "timeout",
}

export enum CardDifficulty {
  Easy = "easy",
  Medium = "medium",
  Hard = "hard",
}

export interface Card {
  id: string;
  front: string;
  back: string;
  acceptableAnswers: string[];
  type: CardType;
  deckId: string;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  equipped: boolean;
}

export interface RecallAttempt {
  cardId: string;
  timestamp: number;
  responseTime: number;
  quality: AnswerQuality;
  wasTimed: boolean;
}

export interface CardStats {
  totalAttempts: number;
  correctCount: number;
  consecutiveCorrect: number;
  bestStreak: number;
  totalResponseTime: number;
}

// SM-2 scheduling (legacy)
export interface LegacyScheduleData {
  cardId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string; // ISO date string
}

// FSRS scheduling
export interface ScheduleData {
  cardId: string;
  difficulty: number;
  stability: number;
  reps: number;
  lapses: number;
  state: "new" | "learning" | "review" | "relearning";
  due: string;
  lastReview: string;
}

// Zone
export interface Zone {
  id: string;
  name: string;
  deckId: string;
  requiredMastery: number;
  bossDefeated: boolean;
  orderIndex: number;
}

// Cloze parsing
export interface ClozeResult {
  displayText: string;
  answers: string[];
}

// Re-exports
export * from "./player.js";
export * from "./combat.js";
