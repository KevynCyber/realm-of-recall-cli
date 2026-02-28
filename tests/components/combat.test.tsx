import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";

const delay = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));
import { ThemeProvider } from "../../src/components/app/ThemeProvider.js";
import { EnemyDisplay } from "../../src/components/combat/EnemyDisplay.js";
import { CombatLog } from "../../src/components/combat/CombatLog.js";
import { DamageNumber } from "../../src/components/combat/DamageNumber.js";
import { LootDrop } from "../../src/components/combat/LootDrop.js";
import { EnemyTier } from "../../src/types/combat.js";
import type { CombatEvent } from "../../src/types/combat.js";
import { EquipmentSlot, Rarity } from "../../src/types/player.js";
import type { Equipment } from "../../src/types/player.js";

function themed(element: React.ReactElement) {
  return <ThemeProvider>{element}</ThemeProvider>;
}

describe("DamageNumber", () => {
  it("renders dealt damage amount", () => {
    const { lastFrame } = render(themed(<DamageNumber amount={25} type="dealt" />));
    expect(lastFrame()).toContain("25");
  });

  it("renders received damage amount", () => {
    const { lastFrame } = render(themed(<DamageNumber amount={10} type="received" />));
    expect(lastFrame()).toContain("10");
  });

  it("renders critical with CRIT! prefix", () => {
    const { lastFrame } = render(themed(<DamageNumber amount={50} type="critical" />));
    expect(lastFrame()).toContain("CRIT!");
    expect(lastFrame()).toContain("50");
  });
});

describe("EnemyDisplay", () => {
  it("renders enemy name and tier", () => {
    const enemy = {
      name: "Goblin",
      tier: EnemyTier.Common,
      hp: 80,
      maxHp: 100,
      attack: 10,
      xpReward: 50,
      goldReward: 20,
    };
    const { lastFrame } = render(themed(<EnemyDisplay enemy={enemy} />));
    const frame = lastFrame();
    expect(frame).toContain("Goblin");
    expect(frame).toContain("common");
  });

  it("renders HP values", () => {
    const enemy = {
      name: "Dragon",
      tier: EnemyTier.Boss,
      hp: 150,
      maxHp: 300,
      attack: 25,
      xpReward: 200,
      goldReward: 100,
    };
    const { lastFrame } = render(themed(<EnemyDisplay enemy={enemy} />));
    expect(lastFrame()).toContain("HP 150/300");
  });

  it("renders ASCII art for each tier", () => {
    const tiers = [EnemyTier.Minion, EnemyTier.Common, EnemyTier.Elite, EnemyTier.Boss];
    for (const tier of tiers) {
      const enemy = {
        name: "Test",
        tier,
        hp: 50,
        maxHp: 100,
        attack: 10,
        xpReward: 50,
        goldReward: 20,
      };
      const { lastFrame } = render(themed(<EnemyDisplay enemy={enemy} />));
      // Each tier has ASCII art lines rendered
      expect(lastFrame()).toBeTruthy();
    }
  });

  it("renders HP bar characters", () => {
    const enemy = {
      name: "Slime",
      tier: EnemyTier.Minion,
      hp: 50,
      maxHp: 100,
      attack: 5,
      xpReward: 10,
      goldReward: 5,
    };
    const { lastFrame } = render(themed(<EnemyDisplay enemy={enemy} />));
    const frame = lastFrame();
    // Should contain filled and empty bar chars
    expect(frame).toContain("█");
    expect(frame).toContain("░");
  });
});

describe("CombatLog", () => {
  it("renders empty state message when no events", () => {
    const { lastFrame } = render(themed(<CombatLog events={[]} />));
    expect(lastFrame()).toContain("Combat begins...");
  });

  it("renders player actions with >> prefix", () => {
    const events: CombatEvent[] = [
      { action: "player_attack", damage: 15, description: "You strike for 15 damage!" },
    ];
    const { lastFrame } = render(themed(<CombatLog events={events} />));
    expect(lastFrame()).toContain(">>");
    expect(lastFrame()).toContain("You strike for 15 damage!");
  });

  it("renders enemy actions with << prefix", () => {
    const events: CombatEvent[] = [
      { action: "enemy_attack", damage: 8, description: "Enemy strikes for 8 damage!" },
    ];
    const { lastFrame } = render(themed(<CombatLog events={events} />));
    expect(lastFrame()).toContain("<<");
    expect(lastFrame()).toContain("Enemy strikes for 8 damage!");
  });

  it("renders player_critical as player action", () => {
    const events: CombatEvent[] = [
      { action: "player_critical", damage: 30, description: "Critical hit for 30!" },
    ];
    const { lastFrame } = render(themed(<CombatLog events={events} />));
    expect(lastFrame()).toContain(">>");
  });

  it("renders player_glancing as player action", () => {
    const events: CombatEvent[] = [
      { action: "player_glancing", damage: 5, description: "Glancing blow for 5" },
    ];
    const { lastFrame } = render(themed(<CombatLog events={events} />));
    expect(lastFrame()).toContain(">>");
  });

  it("renders enemy_poison as enemy action", () => {
    const events: CombatEvent[] = [
      { action: "enemy_poison", damage: 5, description: "Poison ticks for 5!" },
    ];
    const { lastFrame } = render(themed(<CombatLog events={events} />));
    expect(lastFrame()).toContain("<<");
  });

  it("shows only the last 6 events", () => {
    const events: CombatEvent[] = Array.from({ length: 8 }, (_, i) => ({
      action: "player_attack" as const,
      damage: i + 1,
      description: `Event ${i + 1}`,
    }));
    const { lastFrame } = render(themed(<CombatLog events={events} />));
    const frame = lastFrame();
    expect(frame).not.toContain("Event 1");
    expect(frame).not.toContain("Event 2");
    expect(frame).toContain("Event 3");
    expect(frame).toContain("Event 8");
  });
});

describe("LootDrop", () => {
  const equipment: Equipment = {
    id: "sword-1",
    name: "Iron Sword",
    slot: EquipmentSlot.Weapon,
    rarity: Rarity.Uncommon,
    attackBonus: 5,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
  };

  it("renders loot found header", () => {
    const onDismiss = vi.fn();
    const { lastFrame } = render(themed(<LootDrop equipment={equipment} onDismiss={onDismiss} />));
    expect(lastFrame()).toContain("Loot Found!");
  });

  it("renders equipment name", () => {
    const onDismiss = vi.fn();
    const { lastFrame } = render(themed(<LootDrop equipment={equipment} onDismiss={onDismiss} />));
    expect(lastFrame()).toContain("Iron Sword");
  });

  it("renders equipment slot", () => {
    const onDismiss = vi.fn();
    const { lastFrame } = render(themed(<LootDrop equipment={equipment} onDismiss={onDismiss} />));
    expect(lastFrame()).toContain("weapon");
  });

  it("renders stat bonuses", () => {
    const onDismiss = vi.fn();
    const { lastFrame } = render(themed(<LootDrop equipment={equipment} onDismiss={onDismiss} />));
    expect(lastFrame()).toContain("+5 ATK");
  });

  it("renders special effect when present", () => {
    const epicSword: Equipment = {
      ...equipment,
      rarity: Rarity.Epic,
      specialEffect: "Burns enemies on hit",
    };
    const onDismiss = vi.fn();
    const { lastFrame } = render(themed(<LootDrop equipment={epicSword} onDismiss={onDismiss} />));
    expect(lastFrame()).toContain("Burns enemies on hit");
  });

  it("renders multiple stat bonuses", () => {
    const multiStat: Equipment = {
      ...equipment,
      attackBonus: 3,
      defenseBonus: 2,
      critBonusPct: 5,
    };
    const onDismiss = vi.fn();
    const { lastFrame } = render(themed(<LootDrop equipment={multiStat} onDismiss={onDismiss} />));
    const frame = lastFrame();
    expect(frame).toContain("+3 ATK");
    expect(frame).toContain("+2 DEF");
    expect(frame).toContain("+5% Crit");
  });

  it("calls onDismiss when Enter is pressed", async () => {
    const onDismiss = vi.fn();
    const { stdin } = render(themed(<LootDrop equipment={equipment} onDismiss={onDismiss} />));
    await delay();
    stdin.write("\r");
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
