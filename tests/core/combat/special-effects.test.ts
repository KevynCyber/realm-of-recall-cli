import { describe, it, expect } from "vitest";
import {
  parseSpecialEffect,
  parseEquipmentEffects,
  applySpecialEffects,
  resolveTurn,
  createCombatState,
  getCombatRewards,
} from "../../../src/core/combat/CombatEngine.js";
import type { ParsedSpecialEffect } from "../../../src/core/combat/CombatEngine.js";
import { AnswerQuality, EquipmentSlot, Rarity } from "../../../src/types/index.js";
import type { Equipment } from "../../../src/types/index.js";
import { EnemyTier } from "../../../src/types/combat.js";
import type { Enemy } from "../../../src/types/combat.js";

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    name: "Goblin",
    tier: EnemyTier.Common,
    hp: 100,
    maxHp: 100,
    attack: 10,
    xpReward: 50,
    goldReward: 20,
    ...overrides,
  };
}

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: "eq-test",
    name: "Test Item",
    slot: EquipmentSlot.Weapon,
    rarity: Rarity.Rare,
    attackBonus: 0,
    defenseBonus: 0,
    hpBonus: 0,
    xpBonusPct: 0,
    goldBonusPct: 0,
    critBonusPct: 0,
    ...overrides,
  };
}

// ── parseSpecialEffect ──────────────────────────────────────

describe("parseSpecialEffect", () => {
  it("parses 'Perfect answers deal +N bonus damage'", () => {
    const result = parseSpecialEffect("Perfect answers deal +3 bonus damage", "Quill of Recall");
    expect(result.type).toBe("bonus_damage_on_perfect");
    expect(result.value).toBe(3);
    expect(result.itemName).toBe("Quill of Recall");
  });

  it("parses 'Correct answers heal N HP'", () => {
    const result = parseSpecialEffect("Correct answers heal 5 HP", "Healing Ring");
    expect(result.type).toBe("heal_on_correct");
    expect(result.value).toBe(5);
    expect(result.itemName).toBe("Healing Ring");
  });

  it("parses 'Critical hits deal double damage'", () => {
    const result = parseSpecialEffect("Critical hits deal double damage", "Power Gauntlets");
    expect(result.type).toBe("double_crit_damage");
    expect(result.value).toBe(2);
    expect(result.itemName).toBe("Power Gauntlets");
  });

  it("parses '+N% gold from combat'", () => {
    const result = parseSpecialEffect("+15% gold from combat", "Gold Amulet");
    expect(result.type).toBe("gold_bonus_pct");
    expect(result.value).toBe(15);
    expect(result.itemName).toBe("Gold Amulet");
  });

  it("returns unknown for unrecognized effect strings", () => {
    const result = parseSpecialEffect("Revive once per combat with 25% HP", "Phoenix Feather");
    expect(result.type).toBe("unknown");
    expect(result.value).toBe(0);
  });

  it("returns unknown for 'Streak bonus doubled'", () => {
    const result = parseSpecialEffect("Streak bonus doubled", "Crown of Mastery");
    expect(result.type).toBe("unknown");
  });
});

// ── parseEquipmentEffects ───────────────────────────────────

describe("parseEquipmentEffects", () => {
  it("returns empty array when no items have special effects", () => {
    const items = [makeEquipment()];
    expect(parseEquipmentEffects(items)).toEqual([]);
  });

  it("parses multiple items with special effects", () => {
    const items = [
      makeEquipment({ name: "Quill", specialEffect: "Perfect answers deal +3 bonus damage" }),
      makeEquipment({ name: "Gold Ring", specialEffect: "+10% gold from combat" }),
    ];
    const effects = parseEquipmentEffects(items);
    expect(effects).toHaveLength(2);
    expect(effects[0].type).toBe("bonus_damage_on_perfect");
    expect(effects[1].type).toBe("gold_bonus_pct");
  });

  it("skips unknown effects", () => {
    const items = [
      makeEquipment({ name: "Phoenix Feather", specialEffect: "Revive once per combat with 25% HP" }),
      makeEquipment({ name: "Quill", specialEffect: "Perfect answers deal +5 bonus damage" }),
    ];
    const effects = parseEquipmentEffects(items);
    expect(effects).toHaveLength(1);
    expect(effects[0].type).toBe("bonus_damage_on_perfect");
  });

  it("skips items without specialEffect", () => {
    const items = [
      makeEquipment({ name: "Plain Sword" }),
    ];
    const effects = parseEquipmentEffects(items);
    expect(effects).toHaveLength(0);
  });
});

// ── applySpecialEffects ─────────────────────────────────────

describe("applySpecialEffects", () => {
  it("applies bonus damage on Perfect", () => {
    const effects: ParsedSpecialEffect[] = [
      { type: "bonus_damage_on_perfect", value: 3, itemName: "Quill", raw: "" },
    ];
    const result = applySpecialEffects(AnswerQuality.Perfect, "player_attack", effects);
    expect(result.bonusDamage).toBe(3);
    expect(result.activations).toHaveLength(1);
    expect(result.activations[0]).toContain("Quill");
    expect(result.activations[0]).toContain("+3 bonus damage");
  });

  it("does not apply bonus damage on Correct", () => {
    const effects: ParsedSpecialEffect[] = [
      { type: "bonus_damage_on_perfect", value: 3, itemName: "Quill", raw: "" },
    ];
    const result = applySpecialEffects(AnswerQuality.Correct, "player_attack", effects);
    expect(result.bonusDamage).toBe(0);
    expect(result.activations).toHaveLength(0);
  });

  it("applies heal on Correct", () => {
    const effects: ParsedSpecialEffect[] = [
      { type: "heal_on_correct", value: 5, itemName: "Ring", raw: "" },
    ];
    const result = applySpecialEffects(AnswerQuality.Correct, "player_attack", effects);
    expect(result.healAmount).toBe(5);
    expect(result.activations).toHaveLength(1);
    expect(result.activations[0]).toContain("Ring");
    expect(result.activations[0]).toContain("heal 5 HP");
  });

  it("applies heal on Perfect (heal_on_correct triggers for both)", () => {
    const effects: ParsedSpecialEffect[] = [
      { type: "heal_on_correct", value: 5, itemName: "Ring", raw: "" },
    ];
    const result = applySpecialEffects(AnswerQuality.Perfect, "player_attack", effects);
    expect(result.healAmount).toBe(5);
    expect(result.activations).toHaveLength(1);
  });

  it("does not apply heal on Wrong", () => {
    const effects: ParsedSpecialEffect[] = [
      { type: "heal_on_correct", value: 5, itemName: "Ring", raw: "" },
    ];
    const result = applySpecialEffects(AnswerQuality.Wrong, "enemy_attack", effects);
    expect(result.healAmount).toBe(0);
    expect(result.activations).toHaveLength(0);
  });

  it("applies double crit on player_critical", () => {
    const effects: ParsedSpecialEffect[] = [
      { type: "double_crit_damage", value: 2, itemName: "Gauntlets", raw: "" },
    ];
    const result = applySpecialEffects(AnswerQuality.Perfect, "player_critical", effects);
    expect(result.doubleCrit).toBe(true);
    expect(result.activations).toHaveLength(1);
    expect(result.activations[0]).toContain("Gauntlets");
    expect(result.activations[0]).toContain("critical damage doubled");
  });

  it("does not apply double crit on normal attack", () => {
    const effects: ParsedSpecialEffect[] = [
      { type: "double_crit_damage", value: 2, itemName: "Gauntlets", raw: "" },
    ];
    const result = applySpecialEffects(AnswerQuality.Perfect, "player_attack", effects);
    expect(result.doubleCrit).toBe(false);
    expect(result.activations).toHaveLength(0);
  });

  it("accumulates gold bonus from multiple items", () => {
    const effects: ParsedSpecialEffect[] = [
      { type: "gold_bonus_pct", value: 10, itemName: "Coin", raw: "" },
      { type: "gold_bonus_pct", value: 15, itemName: "Ring", raw: "" },
    ];
    const result = applySpecialEffects(AnswerQuality.Perfect, "player_attack", effects);
    expect(result.goldBonusPct).toBe(25);
    // Gold bonus is passive, no per-turn activation messages
    expect(result.activations).toHaveLength(0);
  });

  it("stacks multiple effects from different items", () => {
    const effects: ParsedSpecialEffect[] = [
      { type: "bonus_damage_on_perfect", value: 3, itemName: "Quill", raw: "" },
      { type: "heal_on_correct", value: 5, itemName: "Ring", raw: "" },
    ];
    const result = applySpecialEffects(AnswerQuality.Perfect, "player_attack", effects);
    expect(result.bonusDamage).toBe(3);
    expect(result.healAmount).toBe(5);
    expect(result.activations).toHaveLength(2);
  });
});

// ── resolveTurn with equipment effects ──────────────────────

describe("resolveTurn with equipment special effects", () => {
  const playerAttack = 10;
  const playerDefense = 3;
  const critChance = 0;
  const noCritRng = () => 1;

  it("adds bonus damage on Perfect answer", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const effects: ParsedSpecialEffect[] = [
      { type: "bonus_damage_on_perfect", value: 3, itemName: "Quill of Recall", raw: "Perfect answers deal +3 bonus damage" },
    ];
    const { newState, event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
      undefined, undefined, undefined, effects,
    );

    // Base damage: 10 * 2.0 = 20, plus 3 bonus = 23
    expect(event.damage).toBe(23);
    expect(newState.enemy.hp).toBe(77); // 100 - 23
    // Should have activation event in events list
    const activationEvents = newState.events.filter(e => e.description.includes("Quill of Recall activates"));
    expect(activationEvents).toHaveLength(1);
  });

  it("does not add bonus damage on Correct answer", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const effects: ParsedSpecialEffect[] = [
      { type: "bonus_damage_on_perfect", value: 3, itemName: "Quill", raw: "" },
    ];
    const { event } = resolveTurn(
      state, AnswerQuality.Correct, playerAttack, playerDefense, critChance, noCritRng,
      undefined, undefined, undefined, effects,
    );

    // Base damage: 10 * 1.0 = 10, no bonus
    expect(event.damage).toBe(10);
  });

  it("heals player on Correct answer", () => {
    const state = createCombatState(makeEnemy(), 100, 80, 5);
    const effects: ParsedSpecialEffect[] = [
      { type: "heal_on_correct", value: 5, itemName: "Healing Ring", raw: "" },
    ];
    const { newState } = resolveTurn(
      state, AnswerQuality.Correct, playerAttack, playerDefense, critChance, noCritRng,
      undefined, undefined, undefined, effects,
    );

    expect(newState.playerHp).toBe(85); // 80 + 5
  });

  it("heals player on Perfect answer (heal_on_correct)", () => {
    const state = createCombatState(makeEnemy(), 100, 70, 5);
    const effects: ParsedSpecialEffect[] = [
      { type: "heal_on_correct", value: 10, itemName: "Ring", raw: "" },
    ];
    const { newState } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
      undefined, undefined, undefined, effects,
    );

    expect(newState.playerHp).toBe(80); // 70 + 10
  });

  it("heal does not exceed max HP", () => {
    const state = createCombatState(makeEnemy(), 100, 98, 5);
    const effects: ParsedSpecialEffect[] = [
      { type: "heal_on_correct", value: 10, itemName: "Ring", raw: "" },
    ];
    const { newState } = resolveTurn(
      state, AnswerQuality.Correct, playerAttack, playerDefense, critChance, noCritRng,
      undefined, undefined, undefined, effects,
    );

    expect(newState.playerHp).toBe(100); // Capped at maxHp
  });

  it("doubles critical hit damage", () => {
    const state = createCombatState(makeEnemy({ hp: 200 }), 100, 100, 5);
    const effects: ParsedSpecialEffect[] = [
      { type: "double_crit_damage", value: 2, itemName: "Power Gauntlets", raw: "" },
    ];
    const { newState, event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense,
      100, // 100% crit chance
      () => 0, // rng guarantees crit
      undefined, undefined, undefined, effects,
    );

    // Normal crit damage: floor(10 * 2.5) = 25, doubled = 50
    expect(event.action).toBe("player_critical");
    expect(event.damage).toBe(50);
    expect(newState.enemy.hp).toBe(150); // 200 - 50
  });

  it("does not double damage on non-crit attacks", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const effects: ParsedSpecialEffect[] = [
      { type: "double_crit_damage", value: 2, itemName: "Power Gauntlets", raw: "" },
    ];
    const { event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
      undefined, undefined, undefined, effects,
    );

    // No crit, so normal damage: floor(10 * 2.0) = 20
    expect(event.damage).toBe(20);
    expect(event.action).toBe("player_attack");
  });

  it("works with no equipment effects (backward compatible)", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const { event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
    );

    expect(event.damage).toBe(20); // Same as before
  });

  it("stacks bonus damage and heal on Perfect", () => {
    const state = createCombatState(makeEnemy(), 100, 80, 5);
    const effects: ParsedSpecialEffect[] = [
      { type: "bonus_damage_on_perfect", value: 5, itemName: "Quill", raw: "" },
      { type: "heal_on_correct", value: 3, itemName: "Ring", raw: "" },
    ];
    const { newState, event } = resolveTurn(
      state, AnswerQuality.Perfect, playerAttack, playerDefense, critChance, noCritRng,
      undefined, undefined, undefined, effects,
    );

    // Damage: 20 base + 5 bonus = 25
    expect(event.damage).toBe(25);
    expect(newState.enemy.hp).toBe(75); // 100 - 25
    // Heal: 80 + 3 = 83
    expect(newState.playerHp).toBe(83);
  });

  it("does not apply effects on Wrong answers (except gold passive)", () => {
    const state = createCombatState(makeEnemy(), 100, 100, 5);
    const effects: ParsedSpecialEffect[] = [
      { type: "bonus_damage_on_perfect", value: 5, itemName: "Quill", raw: "" },
      { type: "heal_on_correct", value: 3, itemName: "Ring", raw: "" },
    ];
    const { newState, event } = resolveTurn(
      state, AnswerQuality.Wrong, playerAttack, playerDefense, critChance, noCritRng,
      undefined, undefined, undefined, effects,
    );

    // Enemy attacks: max(1, 10-3) = 7
    expect(event.damage).toBe(7);
    expect(event.action).toBe("enemy_attack");
    expect(newState.playerHp).toBe(93);
    // No activation events (no bonuses on wrong)
    const activationEvents = newState.events.filter(e =>
      e.description.includes("activates")
    );
    expect(activationEvents).toHaveLength(0);
  });
});

// ── getCombatRewards with gold bonus effect ─────────────────

describe("getCombatRewards with equipment special effects", () => {
  it("applies +N% gold bonus from equipment special effects", () => {
    const enemy = makeEnemy({ xpReward: 100, goldReward: 100 });
    const state = createCombatState(enemy, 100, 100, 5);
    state.stats.perfectCount = 3;
    state.stats.correctCount = 2;

    const effects: ParsedSpecialEffect[] = [
      { type: "gold_bonus_pct", value: 20, itemName: "Gold Amulet", raw: "+20% gold from combat" },
    ];

    const rewards = getCombatRewards(state, enemy, 0, 0, 0, effects);
    // Gold: floor(100 * (1 + 20/100)) = floor(100 * 1.2) = 120
    expect(rewards.gold).toBe(120);
  });

  it("stacks gold bonus from multiple equipment effects", () => {
    const enemy = makeEnemy({ goldReward: 100 });
    const state = createCombatState(enemy, 100, 100, 5);
    state.stats.perfectCount = 1;

    const effects: ParsedSpecialEffect[] = [
      { type: "gold_bonus_pct", value: 10, itemName: "Coin", raw: "+10% gold from combat" },
      { type: "gold_bonus_pct", value: 15, itemName: "Ring", raw: "+15% gold from combat" },
    ];

    const rewards = getCombatRewards(state, enemy, 0, 0, 0, effects);
    // Gold: floor(100 * (1 + 25/100)) = floor(100 * 1.25) = 125
    expect(rewards.gold).toBe(125);
  });

  it("combines class gold bonus with equipment gold bonus", () => {
    const enemy = makeEnemy({ goldReward: 100 });
    const state = createCombatState(enemy, 100, 100, 5);
    state.stats.perfectCount = 1;

    const effects: ParsedSpecialEffect[] = [
      { type: "gold_bonus_pct", value: 10, itemName: "Coin", raw: "+10% gold from combat" },
    ];

    // classGoldBonusPct=5, equipGoldBonusPct=10 => total=15
    const rewards = getCombatRewards(state, enemy, 0, 0, 5, effects);
    // Gold: floor(100 * (1 + 15/100)) = floor(100 * 1.15) = 114 (floating point)
    expect(rewards.gold).toBe(114);
  });

  it("works without equipment effects (backward compatible)", () => {
    const enemy = makeEnemy({ goldReward: 50 });
    const state = createCombatState(enemy, 100, 100, 5);
    state.stats.perfectCount = 1;

    const rewards = getCombatRewards(state, enemy, 0, 0, 0);
    expect(rewards.gold).toBe(50); // No bonus
  });

  it("non-gold effects do not affect gold rewards", () => {
    const enemy = makeEnemy({ goldReward: 100 });
    const state = createCombatState(enemy, 100, 100, 5);
    state.stats.perfectCount = 1;

    const effects: ParsedSpecialEffect[] = [
      { type: "bonus_damage_on_perfect", value: 5, itemName: "Quill", raw: "" },
      { type: "heal_on_correct", value: 3, itemName: "Ring", raw: "" },
    ];

    const rewards = getCombatRewards(state, enemy, 0, 0, 0, effects);
    expect(rewards.gold).toBe(100); // No gold bonus from non-gold effects
  });
});
