import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { ThemeProvider } from "../../src/components/app/ThemeProvider.js";
import { HubScreen } from "../../src/components/screens/HubScreen.js";
import { StatsScreen } from "../../src/components/screens/StatsScreen.js";
import { MapScreen } from "../../src/components/screens/MapScreen.js";
import { DeckScreen } from "../../src/components/screens/DeckScreen.js";
import { InventoryScreen } from "../../src/components/screens/InventoryScreen.js";
import { PlayerClass, EquipmentSlot, Rarity } from "../../src/types/player.js";
import type { Player, Equipment } from "../../src/types/player.js";
import type { Zone } from "../../src/types/index.js";

const delay = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

function themed(element: React.ReactElement) {
  return <ThemeProvider>{element}</ThemeProvider>;
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: "TestHero",
    class: PlayerClass.Warrior,
    level: 10,
    xp: 500,
    hp: 120,
    maxHp: 120,
    attack: 14,
    defense: 7,
    gold: 250,
    streakDays: 5,
    longestStreak: 14,
    lastReviewDate: "2026-02-28",
    shieldCount: 2,
    totalReviews: 200,
    totalCorrect: 170,
    combatWins: 30,
    combatLosses: 10,
    wisdomXp: 0,
    ascensionLevel: 0,
    skillPoints: 0,
    dailyChallengeSeed: null,
    dailyChallengeCompleted: false,
    dailyChallengeScore: 0,
    dailyChallengeDate: null,
    desiredRetention: 0.9,
    maxNewCardsPerDay: 20,
    timerSeconds: 30,
    createdAt: "2026-02-01",
    ...overrides,
  };
}

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: "eq-1",
    name: "Iron Sword",
    slot: EquipmentSlot.Weapon,
    rarity: Rarity.Common,
    attackBonus: 3,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
    ...overrides,
  };
}

// ─── HubScreen ───

describe("HubScreen", () => {
  it("renders the game title", () => {
    const onNavigate = vi.fn();
    const { lastFrame } = render(
      themed(<HubScreen cardsDue={0} streakAtRisk={false} onNavigate={onNavigate} />),
    );
    expect(lastFrame()).toContain("Realm of Recall");
  });

  it("renders all menu items", () => {
    const onNavigate = vi.fn();
    const { lastFrame } = render(
      themed(<HubScreen cardsDue={0} streakAtRisk={false} onNavigate={onNavigate} />),
    );
    const frame = lastFrame();
    expect(frame).toContain("Adventure");
    expect(frame).toContain("Quick Review");
    expect(frame).toContain("Dungeon Run");
    expect(frame).toContain("Daily Challenge");
    expect(frame).toContain("Inventory");
    expect(frame).toContain("World Map");
    expect(frame).toContain("Achievements");
    expect(frame).toContain("Stats");
    expect(frame).toContain("Manage Decks");
  });

  it("renders cards due count when > 0", () => {
    const onNavigate = vi.fn();
    const { lastFrame } = render(
      themed(<HubScreen cardsDue={15} streakAtRisk={false} onNavigate={onNavigate} />),
    );
    expect(lastFrame()).toContain("15 cards due today");
  });

  it("does not render cards due when 0", () => {
    const onNavigate = vi.fn();
    const { lastFrame } = render(
      themed(<HubScreen cardsDue={0} streakAtRisk={false} onNavigate={onNavigate} />),
    );
    expect(lastFrame()).not.toContain("cards due today");
  });

  it("renders streak warning when at risk", () => {
    const onNavigate = vi.fn();
    const { lastFrame } = render(
      themed(<HubScreen cardsDue={0} streakAtRisk={true} onNavigate={onNavigate} />),
    );
    expect(lastFrame()).toContain("streak is at risk");
  });

  it("navigates via number key press", async () => {
    const onNavigate = vi.fn();
    const { stdin } = render(
      themed(<HubScreen cardsDue={0} streakAtRisk={false} onNavigate={onNavigate} />),
    );
    await delay();
    stdin.write("1");
    expect(onNavigate).toHaveBeenCalledWith("combat");
  });

  it("navigates via arrow keys and Enter", async () => {
    const onNavigate = vi.fn();
    const { stdin } = render(
      themed(<HubScreen cardsDue={0} streakAtRisk={false} onNavigate={onNavigate} />),
    );
    await delay();
    stdin.write("\x1B[B"); // down to Quick Review
    await delay();
    stdin.write("\r"); // enter
    expect(onNavigate).toHaveBeenCalledWith("review");
  });

  it("navigates to correct screen for each number key", async () => {
    const screens = ["combat", "review", "dungeon", "daily_challenge", "inventory", "map", "achievements", "stats", "decks"];
    for (let i = 0; i < screens.length; i++) {
      const onNavigate = vi.fn();
      const { stdin } = render(
        themed(<HubScreen cardsDue={0} streakAtRisk={false} onNavigate={onNavigate} />),
      );
      await delay();
      stdin.write(String(i + 1));
      expect(onNavigate).toHaveBeenCalledWith(screens[i]);
    }
  });
});

// ─── StatsScreen ───

describe("StatsScreen", () => {
  const fsrsStats = { newCount: 10, learningCount: 5, reviewCount: 80, relearnCount: 3 };

  it("renders player name and class", () => {
    const onBack = vi.fn();
    const player = makePlayer({ name: "Aragon", class: PlayerClass.Warrior });
    const { lastFrame } = render(
      themed(
        <StatsScreen player={player} deckStats={[]} fsrsStats={fsrsStats} onBack={onBack} />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("Aragon");
    expect(frame).toContain("warrior");
  });

  it("renders combat record", () => {
    const onBack = vi.fn();
    const player = makePlayer({ combatWins: 30, combatLosses: 10 });
    const { lastFrame } = render(
      themed(
        <StatsScreen player={player} deckStats={[]} fsrsStats={fsrsStats} onBack={onBack} />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("30");
    expect(frame).toContain("10");
    expect(frame).toContain("75%");
  });

  it("renders study stats", () => {
    const onBack = vi.fn();
    const player = makePlayer({ totalReviews: 200, totalCorrect: 170 });
    const { lastFrame } = render(
      themed(
        <StatsScreen player={player} deckStats={[]} fsrsStats={fsrsStats} onBack={onBack} />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("200");
    expect(frame).toContain("85%");
  });

  it("renders FSRS state counts", () => {
    const onBack = vi.fn();
    const { lastFrame } = render(
      themed(
        <StatsScreen
          player={makePlayer()}
          deckStats={[]}
          fsrsStats={{ newCount: 10, learningCount: 5, reviewCount: 80, relearnCount: 3 }}
          onBack={onBack}
        />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("10");
    expect(frame).toContain("80");
  });

  it("renders streak info", () => {
    const onBack = vi.fn();
    const player = makePlayer({ streakDays: 7, longestStreak: 14 });
    const { lastFrame } = render(
      themed(
        <StatsScreen player={player} deckStats={[]} fsrsStats={fsrsStats} onBack={onBack} />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("7 days");
    expect(frame).toContain("14 days");
  });

  it("renders deck breakdown", () => {
    const onBack = vi.fn();
    const deckStats = [
      { name: "Geography", total: 50, mastered: 30, accuracy: 80 },
      { name: "Math", total: 20, mastered: 10, accuracy: 65 },
    ];
    const { lastFrame } = render(
      themed(
        <StatsScreen player={makePlayer()} deckStats={deckStats} fsrsStats={fsrsStats} onBack={onBack} />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("Geography");
    expect(frame).toContain("30/50 mastered");
    expect(frame).toContain("Math");
  });

  it("shows empty deck message when no decks", () => {
    const onBack = vi.fn();
    const { lastFrame } = render(
      themed(
        <StatsScreen player={makePlayer()} deckStats={[]} fsrsStats={fsrsStats} onBack={onBack} />,
      ),
    );
    expect(lastFrame()).toContain("No decks imported yet");
  });

  it("calls onBack when Escape is pressed", async () => {
    const onBack = vi.fn();
    const { stdin } = render(
      themed(
        <StatsScreen player={makePlayer()} deckStats={[]} fsrsStats={fsrsStats} onBack={onBack} />,
      ),
    );
    await delay();
    stdin.write("\x1B");
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("calls onBack when b is pressed", async () => {
    const onBack = vi.fn();
    const { stdin } = render(
      themed(
        <StatsScreen player={makePlayer()} deckStats={[]} fsrsStats={fsrsStats} onBack={onBack} />,
      ),
    );
    await delay();
    stdin.write("b");
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// ─── MapScreen ───

describe("MapScreen", () => {
  function makeZone(overrides: Partial<Zone> = {}): Zone {
    return {
      id: "zone-1",
      name: "Starter Meadow",
      deckId: "deck-1",
      requiredMastery: 0.7,
      bossDefeated: false,
      orderIndex: 0,
      ...overrides,
    };
  }

  const zones = [
    {
      zone: makeZone({ id: "z1", name: "Starter Meadow", bossDefeated: true }),
      total: 20,
      mastered: 18,
      masteryPct: 90,
      isUnlocked: true,
    },
    {
      zone: makeZone({ id: "z2", name: "Crystal Caves", orderIndex: 1 }),
      total: 30,
      mastered: 15,
      masteryPct: 50,
      isUnlocked: true,
    },
    {
      zone: makeZone({ id: "z3", name: "Shadow Library", orderIndex: 2 }),
      total: 40,
      mastered: 0,
      masteryPct: 0,
      isUnlocked: false,
    },
  ];

  it("renders World Map header", () => {
    const { lastFrame } = render(
      themed(<MapScreen zones={zones} onSelectZone={vi.fn()} onBack={vi.fn()} />),
    );
    expect(lastFrame()).toContain("World Map");
  });

  it("renders all zone names", () => {
    const { lastFrame } = render(
      themed(<MapScreen zones={zones} onSelectZone={vi.fn()} onBack={vi.fn()} />),
    );
    const frame = lastFrame();
    expect(frame).toContain("Starter Meadow");
    expect(frame).toContain("Crystal Caves");
    expect(frame).toContain("Shadow Library");
  });

  it("shows cleared icon for boss-defeated zones", () => {
    const { lastFrame } = render(
      themed(<MapScreen zones={zones} onSelectZone={vi.fn()} onBack={vi.fn()} />),
    );
    expect(lastFrame()).toContain("\u2713");
  });

  it("shows Locked for locked zones", () => {
    const { lastFrame } = render(
      themed(<MapScreen zones={zones} onSelectZone={vi.fn()} onBack={vi.fn()} />),
    );
    expect(lastFrame()).toContain("Locked");
  });

  it("renders mastery percentage for unlocked zones", () => {
    const { lastFrame } = render(
      themed(<MapScreen zones={zones} onSelectZone={vi.fn()} onBack={vi.fn()} />),
    );
    expect(lastFrame()).toContain("90%");
    expect(lastFrame()).toContain("50%");
  });

  it("calls onSelectZone when Enter on unlocked zone", async () => {
    const onSelectZone = vi.fn();
    const { stdin } = render(
      themed(<MapScreen zones={zones} onSelectZone={onSelectZone} onBack={vi.fn()} />),
    );
    await delay();
    stdin.write("\r");
    expect(onSelectZone).toHaveBeenCalledWith("z1");
  });

  it("does not call onSelectZone for locked zones", async () => {
    const onSelectZone = vi.fn();
    const { stdin } = render(
      themed(<MapScreen zones={zones} onSelectZone={onSelectZone} onBack={vi.fn()} />),
    );
    await delay();
    stdin.write("\x1B[B"); // down to Crystal Caves
    await delay();
    stdin.write("\x1B[B"); // down to Shadow Library (locked)
    await delay();
    stdin.write("\r");
    expect(onSelectZone).not.toHaveBeenCalled();
  });

  it("calls onBack when Escape is pressed", async () => {
    const onBack = vi.fn();
    const { stdin } = render(
      themed(<MapScreen zones={zones} onSelectZone={vi.fn()} onBack={onBack} />),
    );
    await delay();
    stdin.write("\x1B");
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("renders detail panel for selected zone", () => {
    const { lastFrame } = render(
      themed(<MapScreen zones={zones} onSelectZone={vi.fn()} onBack={vi.fn()} />),
    );
    expect(lastFrame()).toContain("18 mastered");
  });
});

// ─── DeckScreen ───

describe("DeckScreen", () => {
  const decks = [
    { deck: { id: "d1", name: "Geography", description: "", createdAt: "", equipped: true }, cardCount: 50, dueCount: 10 },
    { deck: { id: "d2", name: "History", description: "", createdAt: "", equipped: false }, cardCount: 30, dueCount: 5 },
    { deck: { id: "d3", name: "Science", description: "", createdAt: "", equipped: true }, cardCount: 40, dueCount: 8 },
  ];

  it("renders Manage Decks header", () => {
    const { lastFrame } = render(
      themed(<DeckScreen decks={decks} onToggle={vi.fn()} onBack={vi.fn()} />),
    );
    expect(lastFrame()).toContain("Manage Decks");
  });

  it("renders all deck names", () => {
    const { lastFrame } = render(
      themed(<DeckScreen decks={decks} onToggle={vi.fn()} onBack={vi.fn()} />),
    );
    const frame = lastFrame();
    expect(frame).toContain("Geography");
    expect(frame).toContain("History");
    expect(frame).toContain("Science");
  });

  it("renders checkboxes: [x] for equipped, [ ] for unequipped", () => {
    const { lastFrame } = render(
      themed(<DeckScreen decks={decks} onToggle={vi.fn()} onBack={vi.fn()} />),
    );
    const frame = lastFrame();
    expect(frame).toContain("[x]");
    expect(frame).toContain("[ ]");
  });

  it("renders card and due counts", () => {
    const { lastFrame } = render(
      themed(<DeckScreen decks={decks} onToggle={vi.fn()} onBack={vi.fn()} />),
    );
    expect(lastFrame()).toContain("50 cards");
    expect(lastFrame()).toContain("10 due");
  });

  it("renders equipped count summary", () => {
    const { lastFrame } = render(
      themed(<DeckScreen decks={decks} onToggle={vi.fn()} onBack={vi.fn()} />),
    );
    expect(lastFrame()).toContain("2/3 decks equipped");
  });

  it("calls onToggle when Enter is pressed on a deck", async () => {
    const onToggle = vi.fn();
    const { stdin } = render(
      themed(<DeckScreen decks={decks} onToggle={onToggle} onBack={vi.fn()} />),
    );
    await delay();
    stdin.write("\x1B[B"); // down to History (unequipped)
    await delay();
    stdin.write("\r");
    expect(onToggle).toHaveBeenCalledWith("d2");
  });

  it("calls onToggle on space key", async () => {
    const onToggle = vi.fn();
    const { stdin } = render(
      themed(<DeckScreen decks={decks} onToggle={onToggle} onBack={vi.fn()} />),
    );
    await delay();
    stdin.write("\x1B[B");
    await delay();
    stdin.write(" ");
    expect(onToggle).toHaveBeenCalledWith("d2");
  });

  it("prevents unequipping the last equipped deck", async () => {
    const singleEquipped = [
      { deck: { id: "d1", name: "Geo", description: "", createdAt: "", equipped: true }, cardCount: 10, dueCount: 2 },
      { deck: { id: "d2", name: "His", description: "", createdAt: "", equipped: false }, cardCount: 5, dueCount: 1 },
    ];
    const onToggle = vi.fn();
    const { stdin } = render(
      themed(<DeckScreen decks={singleEquipped} onToggle={onToggle} onBack={vi.fn()} />),
    );
    await delay();
    stdin.write("\r"); // enter on Geo (the only equipped deck)
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("calls onBack when Escape is pressed", async () => {
    const onBack = vi.fn();
    const { stdin } = render(
      themed(<DeckScreen decks={decks} onToggle={vi.fn()} onBack={onBack} />),
    );
    await delay();
    stdin.write("\x1B");
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// ─── InventoryScreen ───

describe("InventoryScreen", () => {
  const sword = makeEquipment({
    id: "sword-1",
    name: "Iron Sword",
    slot: EquipmentSlot.Weapon,
    rarity: Rarity.Uncommon,
    attackBonus: 5,
  });

  const shield = makeEquipment({
    id: "shield-1",
    name: "Wooden Shield",
    slot: EquipmentSlot.Armor,
    rarity: Rarity.Common,
    defenseBonus: 3,
  });

  const ring = makeEquipment({
    id: "ring-1",
    name: "Gold Ring",
    slot: EquipmentSlot.Accessory,
    rarity: Rarity.Rare,
    goldBonusPct: 10,
  });

  const inventory = [
    { equipment: sword, equipped: true, inventoryId: 1 },
    { equipment: shield, equipped: false, inventoryId: 2 },
    { equipment: ring, equipped: false, inventoryId: 3 },
  ];

  it("renders Inventory header", () => {
    const { lastFrame } = render(
      themed(
        <InventoryScreen
          equippedItems={[sword]}
          inventory={inventory}
          onEquip={vi.fn()}
          onUnequip={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("Inventory");
  });

  it("renders Equipment section with slots", () => {
    const { lastFrame } = render(
      themed(
        <InventoryScreen
          equippedItems={[sword]}
          inventory={inventory}
          onEquip={vi.fn()}
          onUnequip={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("Weapon:");
    expect(frame).toContain("Armor:");
    expect(frame).toContain("Accessory:");
  });

  it("renders equipped item name next to its slot", () => {
    const { lastFrame } = render(
      themed(
        <InventoryScreen
          equippedItems={[sword]}
          inventory={inventory}
          onEquip={vi.fn()}
          onUnequip={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("Iron Sword");
  });

  it("renders [Empty] for unequipped slots", () => {
    const { lastFrame } = render(
      themed(
        <InventoryScreen
          equippedItems={[sword]}
          inventory={inventory}
          onEquip={vi.fn()}
          onUnequip={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("[Empty]");
  });

  it("renders Backpack section with unequipped items", () => {
    const { lastFrame } = render(
      themed(
        <InventoryScreen
          equippedItems={[sword]}
          inventory={inventory}
          onEquip={vi.fn()}
          onUnequip={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("Backpack");
    expect(frame).toContain("Wooden Shield");
    expect(frame).toContain("Gold Ring");
  });

  it("renders No items message when backpack is empty", () => {
    const equippedOnly = [{ equipment: sword, equipped: true, inventoryId: 1 }];
    const { lastFrame } = render(
      themed(
        <InventoryScreen
          equippedItems={[sword]}
          inventory={equippedOnly}
          onEquip={vi.fn()}
          onUnequip={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );
    expect(lastFrame()).toContain("No items in backpack");
  });

  it("calls onEquip when Enter is pressed on backpack item", async () => {
    const onEquip = vi.fn();
    const { stdin } = render(
      themed(
        <InventoryScreen
          equippedItems={[sword]}
          inventory={inventory}
          onEquip={onEquip}
          onUnequip={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );
    await delay();
    stdin.write("\r");
    expect(onEquip).toHaveBeenCalledWith(2);
  });

  it("calls onBack when Escape is pressed in backpack mode", async () => {
    const onBack = vi.fn();
    const { stdin } = render(
      themed(
        <InventoryScreen
          equippedItems={[sword]}
          inventory={inventory}
          onEquip={vi.fn()}
          onUnequip={vi.fn()}
          onBack={onBack}
        />,
      ),
    );
    await delay();
    stdin.write("\x1B");
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("renders Details panel for selected item", () => {
    const { lastFrame } = render(
      themed(
        <InventoryScreen
          equippedItems={[sword]}
          inventory={inventory}
          onEquip={vi.fn()}
          onUnequip={vi.fn()}
          onBack={vi.fn()}
        />,
      ),
    );
    const frame = lastFrame();
    expect(frame).toContain("Details");
    expect(frame).toContain("Rarity:");
  });
});
