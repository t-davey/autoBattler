# First playable skills

**Status: draft, with its [decisions](#decisions) confirmed.** Nothing here is built as written, and every number is a starting value to tune through play. [docs/design.md](design.md#first-playable) sets the scope: 4 Classes, each with 2 Branches of about 3 skills, 24 skills in total. This draft adds the 4 free Class skills a new Hero starts with. For the demo, [docs/demo-skills.md](demo-skills.md) adapts 9 of these skills and overrides this file.

## Decisions

The human confirmed these, which extend the design:

1. **Points per step:** 3 in the first playable. The full game's 5 per step would put step 3 at 10 points, and even levelling gives about 8 points (level 9) by the end of Act 1. At 3 per step, unlocking and learning a step 3 skill costs 7 of those 8 points, which still forces a commitment to one Branch.
2. **Free Class skills:** the 4 under [Free Class skills](#free-class-skills), making 28 skills to build. Each one supplies the damage type its Class loses to the trimmed Branches.
3. **Active and passive split:** each Class gets one Branch of 2 active and 1 passive, and one of 1 active and 2 passive. With the free Class skill, a Hero then has 4 active skills to choose from for 3 slots, which makes the choice real while keeping actives cheap to build.
4. **Out-of-Row penalty:** a skill used from the wrong Row has 60% of its numeric effects. Cost and cooldown don't change.
5. **Reference values:** a Battle lasts 30 seconds, a Hero acts every 3 seconds at base speed, a lantern holds 100 Oil, Oil regenerates 2 per second in a Battle and 30 per Room between Battles, and the free basic attack deals 100% of power as physical damage with reach set by the weapon.

## Reading the tables

- **Step:** the Branch's depth. Step 1 is open from the first point, step 2 needs 3 points spent in the Branch, and step 3 needs 6.
- **Row:** the Row the skill works from at full effect.
- **Reach:** melee reaches only the enemy front Row until it is cleared and needs a melee weapon. Ranged and spell reach either Row. Self skills need no target.
- **Effect:** values run from rank 1 to rank 5, changing evenly. Percentages of power are the skill's strength against the Hero's power stat.
- **Fires when:** the built-in usefulness condition. It applies on top of having the Oil and the cooldown ready.
- **Durations:** given in seconds for now, and they become Ticks once the sim's Tick length is set.

### Effects

These are new concepts, and their rules aren't in the design, so they need the human's review. Once they settle, they belong in [CONTEXT.md](../CONTEXT.md).

| Effect | Rule |
|---|---|
| Bleed | Physical damage over time that ignores armour. Reapplying replaces it. |
| Poison | Damage over time in stacks, up to 5 per enemy. Each stack deals its own damage every 2 seconds. Stacks last 10 seconds, and any new application refreshes them all, even at the limit. Poison resistance reduces it. |
| Burn | Fire damage over time. Reapplying replaces it. Fire resistance reduces it. |
| Slow | Lowers speed for its duration. |
| Curse | A debuff from a Hexer. An enemy holds one Curse at a time. |
| Ward | Absorbs damage before health does, until it runs out or expires. |
| Dodge | The attack misses entirely. Damage over time can't be dodged. |

## Sin-Eater

### Flagellation

| Step | Skill | Kind | Row | Reach | Cost | Cooldown | Effect | Fires when |
|---|---|---|---|---|---|---|---|---|
| 1 | **Penitent Blow** | Active | Front | Melee | 4% max health | 6s | 140% → 200% of power as physical damage to one enemy | Health is above 40% |
| 2 | **Mortified Flesh** | Passive | Front | | | | +2% → +6% power for each 10% of health missing | |
| 3 | **Red Tithe** | Active | Front | Melee | 10% max health | 20s | 120% → 180% of power as physical damage to the whole enemy front Row, healing for 25% of the damage dealt | Health is above 30% and at least 2 enemies stand in the front Row |

### Bulwark

| Step | Skill | Kind | Row | Reach | Cost | Cooldown | Effect | Fires when |
|---|---|---|---|---|---|---|---|---|
| 1 | **Bar the Way** | Active | Front | Self | 15 Oil | 20s | For 6 seconds, every enemy attack on a single target hits this Hero, and this Hero gains +20% → +60% armour | Another Hero is below 80% health |
| 2 | **Iron Penance** | Passive | Either | | | | +10% → +30% armour | |
| 3 | **Shared Burden** | Passive | Front | | | | 10% → 30% of the damage dealt to back-Row Heroes goes to this Hero instead | |

## Huntsman

### Bloodletting

| Step | Skill | Kind | Row | Reach | Cost | Cooldown | Effect | Fires when |
|---|---|---|---|---|---|---|---|---|
| 1 | **Bleeder's Cut** | Active | Front | Melee | 10 Oil | | 80% → 110% of power as physical damage, plus Bleed for 60% → 100% of power over 6 seconds | A reachable enemy isn't Bleeding |
| 2 | **Open Veins** | Passive | Front | | | | +10% → +30% damage to Bleeding enemies | |
| 3 | **The Long Cut** | Active | Front | Melee | 20 Oil | 15s | Ends a target's Bleed and deals all its remaining damage at once, multiplied by 150% → 200% | A reachable enemy is Bleeding |

### Fieldcraft

| Step | Skill | Kind | Row | Reach | Cost | Cooldown | Effect | Fires when |
|---|---|---|---|---|---|---|---|---|
| 1 | **Fall Back** | Active | Either | Self | 15 Oil | 25s | Moves to the other Row, heals 10% → 20% of max health, and Dodges the next attack | Below 50% health in the front Row with another Hero left there; or above 80% health after falling back |
| 2 | **Light Step** | Passive | Either | | | | 5% → 15% chance to Dodge | |
| 3 | **Bind the Wound** | Passive | Either | | | | Each Dodge heals 3% → 7% of max health | |

## Hexer

### Rot

| Step | Skill | Kind | Row | Reach | Cost | Cooldown | Effect | Fires when |
|---|---|---|---|---|---|---|---|---|
| 1 | **Sow Rot** | Active | Back | Spell | 8 Oil | | Adds 1 Poison stack, dealing 15% → 25% of power each time | An enemy is below its stack limit, or its Poison has under 4 seconds left |
| 2 | **Ripening** | Passive | Either | | | | +1 → +5 to the Poison stack limit on enemies this Hero poisons | |
| 3 | **Bloom** | Active | Back | Spell | 20 Oil | 18s | Copies a target's Poison stacks to every other enemy at 50% → 90% of the stack count, rounded up | An enemy has 3 or more stacks and another enemy lives |

### Malediction

| Step | Skill | Kind | Row | Reach | Cost | Cooldown | Effect | Fires when |
|---|---|---|---|---|---|---|---|---|
| 1 | **Wasting Curse** | Active | Back | Spell | 12 Oil | 8s | Curses the uncursed enemy with the most power for 8 seconds: it deals 10% → 22% less damage | An enemy has no Curse |
| 2 | **Spoiled Blood** | Passive | Either | | | | Enemies this Hero has Cursed take 6% → 18% more damage from all sources | |
| 3 | **Leech Hex** | Passive | Either | | | | Heals this Hero for 10% → 30% of the damage it deals to Cursed enemies, Poison included | |

## Lamplighter

### Flame

| Step | Skill | Kind | Row | Reach | Cost | Cooldown | Effect | Fires when |
|---|---|---|---|---|---|---|---|---|
| 1 | **Flare** | Active | Back | Spell | 18 Oil | 6s | 150% → 230% of power as fire damage to one enemy | An enemy lives |
| 2 | **Kindling** | Passive | Back | | | | Fire hits add a Burn worth 20% → 40% of the hit over 4 seconds | |
| 3 | **White Heat** | Passive | Back | | | | +5% → +15% critical chance on fire hits, and fire critical hits splash 30% → 70% of their damage to the rest of the target's Row | |

### Hearth

| Step | Skill | Kind | Row | Reach | Cost | Cooldown | Effect | Fires when |
|---|---|---|---|---|---|---|---|---|
| 1 | **Mend by Lamplight** | Active | Back | Spell | 12 Oil | 6s | Heals the Hero with the lowest health percentage for 120% → 200% of power | A Hero is below 70% health |
| 2 | **Warm Hands** | Passive | Either | | | | The Party recovers 20% → 60% more health between Rooms. Only the highest value in the Party counts | |
| 3 | **Lantern Ward** | Active | Back | Spell | 20 Oil | 25s | Wards every Hero for 60% → 120% of power for 8 seconds | No Hero holds a Ward |

## Free Class skills

Each Hero has this skill from the start at a fixed strength, and it takes no skill points. It uses an active slot like any other skill.

| Class | Skill | Row | Reach | Cost | Effect | Fires when | Damage type restored |
|---|---|---|---|---|---|---|---|
| Sin-Eater | **Consume Sin** | Front | Melee | 8 Oil | 110% of power as holy damage, healing 3% of max health | A reachable enemy lives | Holy, from Litany |
| Huntsman | **Tainted Shaft** | Back | Ranged | 7 Oil | 40% of power as poison damage, plus 1 Poison stack dealing 8% of power each time | An enemy lives | Poison, from Snares |
| Hexer | **Chill Word** | Back | Spell | 8 Oil | 100% of power as cold damage, plus 15% Slow for 4 seconds | An enemy lives | Cold, from Rime |
| Lamplighter | **Votive Spark** | Back | Spell | 6 Oil | 110% of power as holy damage | An enemy lives | Holy, from Vigil |

Tainted Shaft gives the Huntsman its change of role by Row: Bleeds from the front, Poison from the back, with Fall Back moving between them.

## Checks

### Oil

Under the [reference values](#decisions), a Hero gets 90 Oil per Battle and the Room after it. This table is a hand estimate of sample builds, with skills firing in the listed order as soon as they can throughout a 30-second Battle. A Floor has about 7 Battles.

| Build | Oil per Battle | Net | Runs dry after |
|---|---|---|---|
| Sin-Eater: Bar the Way, Penitent Blow, Consume Sin | 62, plus 16% max health | +28 | Never |
| Huntsman: The Long Cut, Bleeder's Cut | 120 | -30 | About 3 Battles |
| Hexer: Bloom, Wasting Curse, Sow Rot | 116 | -26 | About 4 Battles |
| Lamplighter (Hearth): Lantern Ward, Mend by Lamplight, Votive Spark | 112 | -22 | About 4–5 Battles |
| Lamplighter (Flame): Flare, Votive Spark | 120 | -30 | About 3 Battles |
| Lamplighter (mixed): Lantern Ward, Flare, Mend by Lamplight | 160 | -70 | About 1–2 Battles |

Real Battles use less, since Bleed, Curses, and heals are often not needed on every action. The mixed Lamplighter is the build to watch, since 8 points can buy it in Act 1. If Heroes spend too much of a Floor on the basic attack in play, regeneration is the first number to raise.

### Survival without a Lamplighter

The design says any trio can finish. Each Class has its own healing and survivability, so a Party with no Lamplighter still has an answer:

- **Sin-Eater:** Consume Sin, Bulwark's armour, and Red Tithe against packs. Red Tithe needs 2 enemies, so it won't fire against a lone Guardian or Boss.
- **Huntsman:** Fall Back, Light Step, and Bind the Wound.
- **Hexer:** Wasting Curse and Leech Hex.

Cutting Vigil removes the only skill-based cleansing, so cleansing tonics in the Belt are the sole cleanse in the first playable.

### Build cost

The 28 skills rest on a few sim mechanics that don't exist yet: Oil, cooldowns, skill priority, Rows, damage types, damage over time, debuffs, Wards, and Dodge. Four skills each need something of their own, so they are the first to simplify if the build runs long:

- **Bar the Way:** forcing enemy attacks onto one Unit.
- **Fall Back:** moving a Unit between Rows during a Battle.
- **Shared Burden:** redirecting damage between Units.
- **Bloom:** copying Poison stacks between enemies.

## Not in this draft

The 4 Class-specific uniques aren't drafted yet. Enemy resistances, crit multipliers, Class stat rates, and the XP curve are also still to set.
