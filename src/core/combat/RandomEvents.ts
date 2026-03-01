export type EventType =
  | "treasure_room"
  | "wandering_merchant"
  | "mysterious_shrine"
  | "card_blessing"
  | "rest_camp"
  | "cursed_chest"
  | "wisdom_well"
  | "streak_guardian";

export interface EventChoice {
  label: string;
  description: string;
}

export interface RandomEvent {
  type: EventType;
  title: string;
  description: string;
  choices: EventChoice[];
}

export interface EventOutcome {
  description: string;
  goldChange: number;
  hpChange: number;
  xpChange: number;
  wisdomXpChange: number;
  shieldChange: number;
  evolutionBoost: boolean;
}

const EVENT_DEFINITIONS: RandomEvent[] = [
  {
    type: "treasure_room",
    title: "Treasure Room",
    description: "You discover a hidden chamber filled with glittering gold!",
    choices: [
      { label: "Collect carefully", description: "Gain a moderate amount of gold safely" },
      { label: "Grab everything", description: "Gain more gold but risk a trap" },
    ],
  },
  {
    type: "wandering_merchant",
    title: "Wandering Merchant",
    description: "A mysterious merchant appears with rare wares.",
    choices: [
      { label: "Browse wares", description: "Spend gold for a chance at rare equipment" },
      { label: "Trade knowledge", description: "Share wisdom for XP" },
    ],
  },
  {
    type: "mysterious_shrine",
    title: "Mysterious Shrine",
    description: "An ancient shrine pulses with arcane energy.",
    choices: [
      { label: "Pray for strength", description: "Sacrifice HP to gain XP" },
      { label: "Meditate", description: "Gain Wisdom XP peacefully" },
    ],
  },
  {
    type: "card_blessing",
    title: "Card Blessing",
    description: "A spectral librarian offers to strengthen your knowledge.",
    choices: [
      { label: "Accept blessing", description: "Boost a card's evolution progress" },
      { label: "Respectfully decline", description: "Gain a small gold reward instead" },
    ],
  },
  {
    type: "rest_camp",
    title: "Rest Camp",
    description: "You find a safe campfire in the dungeon. The warmth is inviting.",
    choices: [
      { label: "Rest and heal", description: "Recover 30% of max HP" },
      { label: "Train by firelight", description: "Gain XP instead of healing" },
    ],
  },
  {
    type: "cursed_chest",
    title: "Cursed Chest",
    description: "A sinister chest beckons. Great reward or terrible curse?",
    choices: [
      { label: "Open it", description: "50% chance: epic reward or poison damage" },
      { label: "Walk away", description: "Play it safe, gain nothing" },
    ],
  },
  {
    type: "wisdom_well",
    title: "Wisdom Well",
    description: "Crystal-clear water shimmers with ancient knowledge.",
    choices: [
      { label: "Drink deeply", description: "Gain a large amount of Wisdom XP" },
      { label: "Fill your flask", description: "Gain a small amount of Wisdom XP and heal slightly" },
    ],
  },
  {
    type: "streak_guardian",
    title: "Streak Guardian",
    description: "A spectral warrior offers to protect your daily streak.",
    choices: [
      { label: "Accept protection", description: "Earn a streak shield" },
      { label: "Prove your worth", description: "Challenge for gold instead" },
    ],
  },
];

/**
 * Roll for a random event. Returns null if no event triggers.
 */
export function rollForEvent(
  playerHpPercent?: number,
  rng?: () => number,
): RandomEvent | null {
  const random = rng ?? Math.random;
  const baseChance = 0.3;

  if (random() > baseChance) return null;

  const weights = EVENT_DEFINITIONS.map((event) => {
    let weight = 1.0;
    if (playerHpPercent !== undefined) {
      if (event.type === "rest_camp" && playerHpPercent < 50) weight = 2.5;
      if (event.type === "mysterious_shrine" && playerHpPercent > 80) weight = 1.5;
      if (event.type === "cursed_chest" && playerHpPercent < 30) weight = 0.3;
    }
    return weight;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * totalWeight;

  for (let i = 0; i < EVENT_DEFINITIONS.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return EVENT_DEFINITIONS[i];
  }

  return EVENT_DEFINITIONS[EVENT_DEFINITIONS.length - 1];
}

/**
 * Resolve a player's choice for an event.
 */
export function resolveEventChoice(
  event: RandomEvent,
  choiceIndex: number,
  playerLevel: number,
  maxHp: number,
  rng?: () => number,
): EventOutcome {
  const random = rng ?? Math.random;
  const clampedChoice = Math.min(choiceIndex, event.choices.length - 1);
  const noChange: EventOutcome = {
    description: "Nothing happens.",
    goldChange: 0,
    hpChange: 0,
    xpChange: 0,
    wisdomXpChange: 0,
    shieldChange: 0,
    evolutionBoost: false,
  };

  switch (event.type) {
    case "treasure_room":
      return clampedChoice === 0
        ? { ...noChange, description: "You carefully collect the gold.", goldChange: 20 + playerLevel * 5 }
        : random() > 0.3
          ? { ...noChange, description: "You grab a fortune!", goldChange: 40 + playerLevel * 10 }
          : { ...noChange, description: "A trap springs!", goldChange: 10 + playerLevel * 3, hpChange: -Math.ceil(maxHp * 0.15) };

    case "wandering_merchant":
      return clampedChoice === 0
        ? { ...noChange, description: "The merchant's eyes gleam.", goldChange: -(10 + playerLevel * 2) }
        : { ...noChange, description: "The merchant nods wisely.", xpChange: 15 + playerLevel * 3 };

    case "mysterious_shrine":
      return clampedChoice === 0
        ? { ...noChange, description: "Pain courses through you, but you feel stronger.", hpChange: -Math.ceil(maxHp * 0.1), xpChange: 25 + playerLevel * 5 }
        : { ...noChange, description: "The shrine's energy fills you with wisdom.", wisdomXpChange: 30 };

    case "card_blessing":
      return clampedChoice === 0
        ? { ...noChange, description: "Knowledge flows into your cards!", wisdomXpChange: 10, evolutionBoost: true }
        : { ...noChange, description: "The librarian offers a small reward.", goldChange: 15 };

    case "rest_camp":
      return clampedChoice === 0
        ? { ...noChange, description: "You rest peacefully by the fire.", hpChange: Math.ceil(maxHp * 0.3) }
        : { ...noChange, description: "You train your skills by firelight.", xpChange: 20 + playerLevel * 4 };

    case "cursed_chest":
      if (clampedChoice === 1) return { ...noChange, description: "You wisely walk away." };
      return random() > 0.5
        ? { ...noChange, description: "The chest reveals incredible treasure!", goldChange: 50 + playerLevel * 10, xpChange: 30 }
        : { ...noChange, description: "A dark curse erupts!", hpChange: -Math.ceil(maxHp * 0.2) };

    case "wisdom_well":
      return clampedChoice === 0
        ? { ...noChange, description: "Ancient knowledge floods your mind.", wisdomXpChange: 50 }
        : { ...noChange, description: "The cool water refreshes body and mind.", hpChange: Math.ceil(maxHp * 0.1), wisdomXpChange: 20 };

    case "streak_guardian":
      return clampedChoice === 0
        ? { ...noChange, description: "The guardian grants you a streak shield!", shieldChange: 1 }
        : { ...noChange, description: "You defeat the guardian and claim a bounty!", goldChange: 25 + playerLevel * 5 };

    default:
      return noChange;
  }
}

/**
 * Get all possible event types.
 */
export function getAllEventTypes(): EventType[] {
  return EVENT_DEFINITIONS.map((e) => e.type);
}
