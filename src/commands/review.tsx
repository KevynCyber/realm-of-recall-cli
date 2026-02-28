import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";
import { getDatabase } from "../data/database.js";
import { CardRepository } from "../data/repositories/CardRepository.js";
import { StatsRepository } from "../data/repositories/StatsRepository.js";
import { ReviewScreen } from "../components/review/ReviewScreen.js";
import { ReviewSummary } from "../components/review/ReviewSummary.js";
import { updateSchedule } from "../core/spaced-repetition/Scheduler.js";
import { AnswerQuality, type Card, type ScheduleData } from "../types/index.js";

interface ReviewResult {
  cardId: string;
  quality: AnswerQuality;
  responseTime: number;
}

interface Props {
  deckId?: string;
  limit?: number;
}

export function ReviewCommand({ deckId, limit }: Props) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [results, setResults] = useState<ReviewResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const db = getDatabase();
      const cardRepo = new CardRepository(db);
      const statsRepo = new StatsRepository(db);

      // Get due card IDs
      const dueIds = statsRepo.getDueCardIds(deckId);
      if (dueIds.length === 0) {
        // If no cards due, get all cards (first time)
        const allCards = deckId
          ? cardRepo.getCardsByDeck(deckId)
          : cardRepo.getAllCards();
        if (allCards.length === 0) {
          setError("No cards found. Import a deck first: ror import <file>");
          return;
        }
        const sliced = limit ? allCards.slice(0, limit) : allCards;
        setCards(sliced);
      } else {
        const dueCards = dueIds
          .map((id) => cardRepo.getCard(id))
          .filter((c): c is Card => c !== undefined);
        const sliced = limit ? dueCards.slice(0, limit) : dueCards;
        setCards(sliced);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [deckId, limit]);

  const handleComplete = (reviewResults: ReviewResult[]) => {
    // Save results to DB
    try {
      const db = getDatabase();
      const statsRepo = new StatsRepository(db);

      for (const result of reviewResults) {
        const existing = statsRepo.getSchedule(result.cardId);
        const schedule: ScheduleData = existing ?? {
          cardId: result.cardId,
          easeFactor: 2.5,
          intervalDays: 0,
          repetitions: 0,
          nextReviewAt: new Date().toISOString(),
        };

        const updated = updateSchedule(schedule, result.quality);

        statsRepo.recordAttempt(
          result.cardId,
          {
            cardId: result.cardId,
            timestamp: Date.now(),
            responseTime: result.responseTime,
            quality: result.quality,
            wasTimed: false,
          },
          updated,
        );
      }
    } catch (err: any) {
      // Still show results even if save fails
      console.error("Failed to save results:", err.message);
    }

    setResults(reviewResults);
  };

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  if (!cards) {
    return <Text>Loading cards...</Text>;
  }

  if (results) {
    return <ReviewSummary results={results} />;
  }

  return <ReviewScreen cards={cards} onComplete={handleComplete} />;
}
