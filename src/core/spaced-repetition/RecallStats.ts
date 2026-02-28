import {
  AnswerQuality,
  CardDifficulty,
  type CardStats,
  type RecallAttempt,
} from "../../types/index.js";

export class RecallTracker {
  private stats = new Map<string, CardStats>();
  private attempts = new Map<string, RecallAttempt[]>();

  recordAttempt(
    cardId: string,
    correct: boolean,
    responseTime: number = 0,
    quality: AnswerQuality = correct ? AnswerQuality.Correct : AnswerQuality.Wrong,
    wasTimed: boolean = false,
  ): void {
    let s = this.stats.get(cardId);
    if (!s) {
      s = {
        totalAttempts: 0,
        correctCount: 0,
        consecutiveCorrect: 0,
        bestStreak: 0,
        totalResponseTime: 0,
      };
      this.stats.set(cardId, s);
    }

    s.totalAttempts++;
    s.totalResponseTime += responseTime;

    if (correct) {
      s.correctCount++;
      s.consecutiveCorrect++;
      if (s.consecutiveCorrect > s.bestStreak) {
        s.bestStreak = s.consecutiveCorrect;
      }
    } else {
      s.consecutiveCorrect = 0;
    }

    const attempt: RecallAttempt = {
      cardId,
      timestamp: Date.now(),
      responseTime,
      quality,
      wasTimed,
    };

    let cardAttempts = this.attempts.get(cardId);
    if (!cardAttempts) {
      cardAttempts = [];
      this.attempts.set(cardId, cardAttempts);
    }
    cardAttempts.push(attempt);
  }

  getAccuracy(cardId: string): number {
    const s = this.stats.get(cardId);
    if (!s || s.totalAttempts === 0) return 0;
    return s.correctCount / s.totalAttempts;
  }

  getDifficulty(cardId: string): CardDifficulty {
    const accuracy = this.getAccuracy(cardId);
    const s = this.stats.get(cardId);
    if (!s || s.totalAttempts === 0) return CardDifficulty.Medium;
    if (accuracy > 0.9) return CardDifficulty.Easy;
    if (accuracy >= 0.6) return CardDifficulty.Medium;
    return CardDifficulty.Hard;
  }

  getAverageResponseTime(cardId: string): number {
    const s = this.stats.get(cardId);
    if (!s || s.totalAttempts === 0) return 0;
    return s.totalResponseTime / s.totalAttempts;
  }

  getStreak(cardId: string): number {
    return this.stats.get(cardId)?.consecutiveCorrect ?? 0;
  }

  getBestStreak(cardId: string): number {
    return this.stats.get(cardId)?.bestStreak ?? 0;
  }

  getAttempts(cardId: string): RecallAttempt[] {
    return this.attempts.get(cardId) ?? [];
  }

  getStats(cardId: string): CardStats | undefined {
    return this.stats.get(cardId);
  }

  getAllCardIds(): string[] {
    return [...this.stats.keys()];
  }

  getWeakCards(count: number): string[] {
    return [...this.stats.entries()]
      .filter(([_, s]) => s.totalAttempts > 0)
      .sort(([_, a], [__, b]) => {
        const accA = a.correctCount / a.totalAttempts;
        const accB = b.correctCount / b.totalAttempts;
        return accA - accB;
      })
      .slice(0, count)
      .map(([id]) => id);
  }

  getMasteredCount(): number {
    let count = 0;
    for (const s of this.stats.values()) {
      if (s.totalAttempts >= 10 && s.correctCount / s.totalAttempts > 0.9) {
        count++;
      }
    }
    return count;
  }
}
