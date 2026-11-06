# Demo skills

**Status: approved by the human on 2026-11-05 (stop S2 in [the demo plan](plans/poc-demo.md#human-stops)).** These 9 skills apply to the proof-of-concept demo only, and every number is a starting value that Milestone 6 tunes.

This file is the demo's source of truth for its skills. [Adaptations](#adaptations) lists every change from [First playable skills](first-playable-skills.md), which is worth opening only to see the original of a skill. Open [the M2 review](plans/poc-demo-m2-review.md) when a measurement arrives or a settled answer comes up again.

## Reading the tables

- **Time:** 1 Tick is 100 ms, so 10 Ticks are 1 second.
- **Step:** step 1 is open from the first point. Step 2 needs 2 points spent in the Branch, and step 3 needs 4.
- **Row:** the Row the skill works from at full effect. From the wrong Row it has 60% of its numeric effects, with cost and cooldown unchanged.
- **Fires when:** the built-in usefulness condition, on top of having the Oil and the cooldown ready.
- **Heroes:** a Hero starts with no skills and earns 1 skill point per level. Each Hero acts on a fixed interval, using the first available skill in its order, or else the free basic attack: 100% of power as physical damage, with reach from the weapon.

## Skills

### Sin-Eater: Bulwark

| Step | Skill | Kind | Row | Reach | Oil | Cooldown (Ticks) | Effect | Fires when |
|---|---|---|---|---|---|---|---|---|
| 1 | **Bar the Way** | Active | Front | Self | 15 | 200 | For 60 Ticks, every single-target enemy attack hits this Hero, and it gains bonus armour | Another Hero is below 80% health |
| 2 | **Iron Penance** | Passive | Either | | | | Bonus armour | |
| 3 | **Shared Burden** | Passive | Front | | | | Part of each direct hit and Poison tick on a back-Row Hero goes to this Hero instead | |

### Huntsman: Bloodletting

| Step | Skill | Kind | Row | Reach | Oil | Cooldown (Ticks) | Effect | Fires when |
|---|---|---|---|---|---|---|---|---|
| 1 | **Bleeder's Cut** | Active | Front | Melee | 10 | | A percentage of power as physical damage, plus Bleed over 60 Ticks | A reachable enemy isn't Bleeding |
| 2 | **Open Veins** | Passive | Front | | | | More damage to Bleeding enemies | |
| 3 | **The Long Cut** | Active | Front | Melee | 20 | 150 | Ends a target's Bleed, dealing its remaining damage multiplied | A reachable enemy is Bleeding |

### Lamplighter: Hearth

| Step | Skill | Kind | Row | Reach | Oil | Cooldown (Ticks) | Effect | Fires when |
|---|---|---|---|---|---|---|---|---|
| 1 | **Mend by Lamplight** | Active | Back | Any Hero | 12 | 60 | Heals the Hero with the lowest health percentage | A Hero is below 70% health |
| 2 | **Warm Hands** | Passive | Either | | | | The Party recovers more health between Rooms; only the highest in the Party counts | |
| 3 | **Lantern Ward** | Active | Back | Every Hero | 20 | 250 | Wards every Hero for 80 Ticks | No Hero holds a Ward |

## Values by Skill rank

| Skill | Value | Rank 1 | Rank 2 | Rank 3 | Rank 4 | Rank 5 |
|---|---|---|---|---|---|---|
| Bar the Way | Bonus armour | +20% | +30% | +40% | +50% | +60% |
| Iron Penance | Bonus armour | +10% | +15% | +20% | +25% | +30% |
| Shared Burden | Share of the damage redirected | 10% | 15% | 20% | 25% | 30% |
| Bleeder's Cut | Hit, as % of power | 80% | 87.5% | 95% | 102.5% | 110% |
| Bleeder's Cut | Bleed total, as % of power | 60% | 70% | 80% | 90% | 100% |
| Open Veins | Bonus damage | +10% | +15% | +20% | +25% | +30% |
| The Long Cut | Multiplier on remaining Bleed | 150% | 162.5% | 175% | 187.5% | 200% |
| Mend by Lamplight | Heal, as % of power | 150% | 155% | 160% | 165% | 170% |
| Warm Hands | More health between Rooms | +20% | +30% | +40% | +50% | +60% |
| Lantern Ward | Ward, as % of power | 60% | 75% | 90% | 105% | 120% |

## Effects

| Effect | Rule |
|---|---|
| **Bleed** | Physical damage over time, ticking every 10 Ticks. It ignores armour, but physical resistance reduces it. Reapplying replaces it. |
| **Poison** | Up to 5 stacks per Unit. Each stack deals its own damage every 20 Ticks and lasts 100 Ticks. Any new stack refreshes them all, even at the limit. Poison resistance reduces it. Heroes can't cure it. |
| **Ward** | Absorbs all damage types before health, until used up or expired. |

No Hero applies Poison in the demo. It comes from enemies: Mire Bloats and Sporelings add 1 stack worth 1 damage with each attack, on top of their direct damage.

## Oil

A Hero holds 100 Oil and regenerates 1 every 5 Ticks in a Battle. It carries between Battles. Each Battle in Milestone 2 is followed by +30. From Milestone 3 the +30 comes on leaving any Room, chests included, and Town refills it.

## Adaptations

Each change from [First playable skills](first-playable-skills.md), with its reason:

| Change | Reason |
|---|---|
| **2 points per step**, not 3 | The first Wall falls at about level 7 (6 points). At 3 per step, no step 3 skill is reachable (G6). |
| **No free Class skills** | The scope has "3 skills each, plus a basic attack", and Consume Sin and Votive Spark deal holy damage, which is cut (G5). |
| **Only one Branch per Class** | Approved scope. Penitent Blow, Fall Back, and Flare are among the skills this drops. |
| **Mend by Lamplight heals 150% → 170% of power**, not 120% → 200% | R2 tuning. See [the M2 review](plans/poc-demo-m2-review.md#r2-result). |
| **Durations in Ticks** | The Tick is now 100 ms: 6, 20, 15, 25, and 8 seconds become 60, 200, 150, 250, and 80 Ticks. |
| **Shared Burden covers direct hits and Poison ticks**, the only damage Heroes take in the demo | The human's answer to [question 1](#the-humans-answers). The first-playable wording, "damage dealt", needs spelling out once damage over time exists. |
| **Poison stacks are per Unit**, not per enemy | Enemies poison Heroes here, and no Hero poisons enemies (G15). |
| **Hearth's reach is "Any Hero" or "Every Hero"**, not spell | No Hero skill in the demo casts a spell at an enemy, so the sim needs no spell reach. This also differs from the plan's table. |
| **No limit of 3 active skills** | Each Hero has at most 2, so the limit never binds. |
| **A Huntsman with a ranged weapon can't use its melee skills** | From G14. The planning tab says so. |

## Rules the source leaves unsaid

The plan doesn't settle these, and the human accepted them on 2026-11-05.

**Numbers**

- **Bonus armour** adds up, then multiplies the Hero's armour, gear included once Milestone 4 adds it. Bar the Way and Iron Penance at full ranks give 190% of that armour, not 208%.
- **Out-of-Row:** the 60% applies to amounts, not durations. A Ward from the wrong Row is weaker but lasts as long.
- **Bleed** divides evenly across its 6 ticks, with the first 10 Ticks after it lands. Its total is set from power when applied.
- **Poison:** each stack ticks on its own clock, with its first tick 20 Ticks after it lands. A refresh changes when stacks expire, not when they tick.
- **Critical hits:** Bleeder's Cut's hit can be critical. Bleed, The Long Cut, Poison, heals, and Wards can't.
- **Open Veins** applies to this Huntsman's basic attack and The Long Cut, whose target still counts as Bleeding. It doesn't apply to Bleed ticks, and Bleeder's Cut only ever hits enemies that aren't Bleeding.
- **The Long Cut** works like Bleed: it ignores armour, and physical resistance reduces it.

**Damage and targets**

- **Shared Burden** splits a hit or Poison tick before anything reduces it. Each share then goes through its own receiver's armour, resistance, and Ward.
- **Living Heroes only:** usefulness conditions, heals, Wards, and redirection ignore fallen Heroes. Bar the Way and Shared Burden stop when the Sin-Eater falls.
- **Targets:** Bleeder's Cut picks at random among reachable enemies that aren't Bleeding, and The Long Cut among reachable enemies that are.

**Skill order**

- **Learning an active skill** adds it to the end of the Hero's order.

**Between Battles**

- **Effects and cooldowns** end with the Battle. Every skill starts the next Battle ready, and only health and Oil carry.

## Checks

**Builds:** each Hero has 11 legal 6-point builds at level 7, and all 9 skills are reachable. Those builds reach rank 2 at most in a step 3 skill.

**Oil:** the first-playable draft estimates that a Huntsman using The Long Cut and Bleeder's Cut spends 120 Oil per Battle against 90 gained, running dry after about 3 Battles. The same build applies here. A Lamplighter using Lantern Ward and Mend by Lamplight spends less than that draft's Hearth build, which also included Votive Spark and ran dry after about 4–5 Battles. These are hand estimates, and nothing here has been measured.

**Lantern Ward:** its cooldown of 250 Ticks outlasts its 80-Tick Ward, so with one Lamplighter, "No Hero holds a Ward" never blocks it in the demo.

**Row penalty:** Sin-Eater and Huntsman start in front and never move, so only the Lamplighter can pay it, once it steps forward. Its heals and Wards then run at 60%, just as the Party is losing.

## Rules added during the build

The human accepted these on 2026-11-05:

- **The Long Cut has no minimum damage.** It works like Bleed, so the 1-damage minimum on direct hits doesn't apply.
- **On a shared hit, the 1-damage minimum** applies only to the original target's share.
- **A fallen Hero's Oil carries** into the next Battle, with the same +30.

## The human's answers

Settled on 2026-11-05. [The M2 review](plans/poc-demo-m2-review.md#questions-and-answers) keeps the reasoning.

1. **Shared Burden and the Wall:** it also redirects Poison ticks on back-Row Heroes, so it does something against the Guardian.
2. **Warm Hands in the build check:** R2's "a skill never appears" trigger leaves it out in Milestones 2 and 6. Milestone 6 judges it by comparing whole Runs with and without it. Until Milestone 3, the planning tab says it has no effect yet.
3. **The Sin-Eater's skill order:** unchanged. It has 1 active skill and no order to set, as G5 accepted.
4. **Reapplying Bleed:** Bleeder's Cut keeps its targeting, the rule stays for later Branches, and the test is dropped, since nothing in the demo can reapply a Bleed.
