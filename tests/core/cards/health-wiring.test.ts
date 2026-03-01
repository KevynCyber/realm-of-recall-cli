import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { getInMemoryDatabase } from "../../../src/data/database.js";
import { CardRepository } from "../../../src/data/repositories/CardRepository.js";
import { StatsRepository } from "../../../src/data/repositories/StatsRepository.js";
import {
  AnswerQuality,
  CardType,
  type Card,
  type Deck,
  type ScheduleData,
} from "../../../src/types/index.js";
import { getCardHealth } from "../../../src/core/cards/CardEvolution.js";

let db: Database.Database;
let cardRepo: CardRepository;
let statsRepo: StatsRepository;

const testDeck: Deck = {
  id: "deck1",
  name: "Test Deck",
  description: "For testing",
  createdAt: new Date().toISOString(),
  equipped: true,
};

const testCard: Card = {
  id: "card1",
  front: "Capital of France?",
  back: "Paris",
  acceptableAnswers: ["Paris"],
  type: CardType.Basic,
  deckId: "deck1",
};

function makeSchedule(overrides?: Partial<ScheduleData>): ScheduleData {
  return {
    cardId: "card1",
    difficulty: 5.0,
    stability: 1.0,
    reps: 1,
    lapses: 0,
    state: "learning",
    due: new Date(Date.now() + 86400000).toISOString(),
    lastReview: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  db = getInMemoryDatabase();
  cardRepo = new CardRepository(db);
  statsRepo = new StatsRepository(db);
  cardRepo.createDeck(testDeck);
  cardRepo.insertCard(testCard);
});

describe("getCardHealthData from StatsRepository", () => {
  it("returns empty qualities and 0 lapses for card with no attempts", () => {
    const data = statsRepo.getCardHealthData("card1");
    expect(data.recentQualities).toEqual([]);
    expect(data.totalLapses).toBe(0);
  });

  it("returns recent qualities from attempts", () => {
    const schedule = makeSchedule();

    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now(),
        responseTime: 2.0,
        quality: AnswerQuality.Correct,
        wasTimed: false,
      },
      schedule,
    );
    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now() + 1,
        responseTime: 2.0,
        quality: AnswerQuality.Wrong,
        wasTimed: false,
      },
      schedule,
    );

    const data = statsRepo.getCardHealthData("card1");
    // getRecentQualities returns DESC order (most recent first)
    expect(data.recentQualities).toEqual(["wrong", "correct"]);
  });

  it("returns total lapses from schedule data", () => {
    const schedule = makeSchedule({ lapses: 5 });

    statsRepo.recordAttempt(
      "card1",
      {
        cardId: "card1",
        timestamp: Date.now(),
        responseTime: 2.0,
        quality: AnswerQuality.Wrong,
        wasTimed: false,
      },
      schedule,
    );

    const data = statsRepo.getCardHealthData("card1");
    expect(data.totalLapses).toBe(5);
  });
});

describe("card health computation end-to-end", () => {
  it("returns healthy for a card with all correct answers", () => {
    const schedule = makeSchedule({ lapses: 0 });

    for (let i = 0; i < 5; i++) {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now() + i,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        schedule,
      );
    }

    const data = statsRepo.getCardHealthData("card1");
    const health = getCardHealth(data.recentQualities, data.totalLapses);
    expect(health).toBe("healthy");
  });

  it("returns struggling when 3+ of last 5 are wrong", () => {
    const schedule = makeSchedule({ lapses: 2 });

    // Record 2 correct then 3 wrong
    const qualities = [
      AnswerQuality.Correct,
      AnswerQuality.Correct,
      AnswerQuality.Wrong,
      AnswerQuality.Wrong,
      AnswerQuality.Wrong,
    ];

    for (let i = 0; i < qualities.length; i++) {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now() + i,
          responseTime: 2.0,
          quality: qualities[i],
          wasTimed: false,
        },
        schedule,
      );
    }

    const data = statsRepo.getCardHealthData("card1");
    const health = getCardHealth(data.recentQualities, data.totalLapses);
    expect(health).toBe("struggling");
  });

  it("returns struggling when 3+ of last 5 are timeout", () => {
    const schedule = makeSchedule({ lapses: 1 });

    const qualities = [
      AnswerQuality.Correct,
      AnswerQuality.Timeout,
      AnswerQuality.Timeout,
      AnswerQuality.Timeout,
      AnswerQuality.Correct,
    ];

    for (let i = 0; i < qualities.length; i++) {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now() + i,
          responseTime: 2.0,
          quality: qualities[i],
          wasTimed: false,
        },
        schedule,
      );
    }

    const data = statsRepo.getCardHealthData("card1");
    const health = getCardHealth(data.recentQualities, data.totalLapses);
    expect(health).toBe("struggling");
  });

  it("returns leech when totalLapses >= 5", () => {
    const schedule = makeSchedule({ lapses: 5 });

    // Even with all correct recent answers, 5+ lapses = leech
    for (let i = 0; i < 3; i++) {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now() + i,
          responseTime: 2.0,
          quality: AnswerQuality.Correct,
          wasTimed: false,
        },
        schedule,
      );
    }

    const data = statsRepo.getCardHealthData("card1");
    const health = getCardHealth(data.recentQualities, data.totalLapses);
    expect(health).toBe("leech");
  });

  it("leech takes priority over struggling", () => {
    const schedule = makeSchedule({ lapses: 6 });

    // 3+ wrong in last 5 AND 5+ lapses = leech (not struggling)
    const qualities = [
      AnswerQuality.Wrong,
      AnswerQuality.Wrong,
      AnswerQuality.Wrong,
      AnswerQuality.Correct,
      AnswerQuality.Wrong,
    ];

    for (let i = 0; i < qualities.length; i++) {
      statsRepo.recordAttempt(
        "card1",
        {
          cardId: "card1",
          timestamp: Date.now() + i,
          responseTime: 2.0,
          quality: qualities[i],
          wasTimed: false,
        },
        schedule,
      );
    }

    const data = statsRepo.getCardHealthData("card1");
    const health = getCardHealth(data.recentQualities, data.totalLapses);
    expect(health).toBe("leech");
  });

  it("returns healthy for card with no attempts", () => {
    const data = statsRepo.getCardHealthData("card1");
    const health = getCardHealth(data.recentQualities, data.totalLapses);
    expect(health).toBe("healthy");
  });
});
