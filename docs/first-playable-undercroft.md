# First playable: the Undercroft

The Undercroft's (Act 2) Packs for Floors 6–20 and Guardians for Lamps 2–4. The human chose to build it as drafted on 2026-11-13, so the questions below were answered with the draft's own choices, and step 6 of [the first playable plan](plans/first-playable.md) built it. Every name and number is a starting value, and step 10 tunes them. The Guardians' names are working names, still [open in the bible](lore/bible.md#open-questions).

## The shape

Each Wall leans on one damage type or role, as [Lamps and walls](design.md#lamps-and-walls) asks. The Floors before a Wall add a Family that hints at what's coming, so the Packs teach its answer before the Guardian tests it. No Wall needs a specific Class: every answer comes from gear, from either of 2 Branches, or from where Heroes stand.

| Wall | Floor | Leans on | Answered by |
|---|---|---|---|
| 1, the Mouldering Warden (built) | 5 | Poison | Poison resistance (Sallow), heals |
| 2 | 10 | Physical, on the front Row | Armour (Iron-bound, Bulwark), front-Row health, heals |
| 3 | 15 | The back Row, and Slow | Back-Row health and armour, Bar the Way and Shared Burden, Ward, Dodge, speed |
| 4, ends the Act | 20 | Armour, and outlasting a Curse | Damage that skips armour (Bleed, Poison, Burn, cold, fire, holy), poison resistance, heals |

Wall 4 never needs a Class: each Class's free skill deals holy, poison, or cold damage.

## Packs

The Floor's band decides which Families a Pack rolls from: the band's new Family half the time, and the earlier Undercroft Families the rest. Today every Floor rolls from both Families evenly. Stats are base values, which the Floor's enemy scale multiplies, as now.

| Floors | Families |
|---|---|
| 1–5 | The restless dead, fungal growth (built) |
| 6–10 | adds **the Ossuary** |
| 11–15 | adds **the Drowned** |
| 16–20 | adds **the Deep Growth** |

For scale, today's Sodden Thrall has 125 health, 2 power, an action every 30 Ticks, and 5 armour.

### The Ossuary, Floors 6–10: physical, front-heavy

Bones stacked in the charnel vaults, risen in heavier frames.

| Enemy | Row | Reach, targeting | Health | Power | Every | Damage | Armour | Resistances | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Charnel Brute** | Front | Melee, front first | 220 | 5 | 50 Ticks | Physical | 20 | Cold 25 | Slow, heavy blows that armour answers |
| **Knucklebone Flinger** | Back | Ranged, front first | 80 | 2.5 | 30 Ticks | Physical | 0 | Cold 25 | Adds to the front Row's pressure |

### The Drowned, Floors 11–15: the back Row

The dead from the flooded lower crypts. They reach past the front Row.

| Enemy | Row | Reach, targeting | Health | Power | Every | Damage | Armour | Resistances | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Drowned Mourner** | Front | Melee, front first | 150 | 2 | 30 Ticks | Physical | 5 | Cold 40 | The Family's body |
| **Silt Lurker** | Back | Ranged, **any** | 90 | 2.5 | 30 Ticks | Physical | 0 | Cold 40 | 15% Dodge, half-hidden in the water |
| **Drowned Bellman** | Back | Ranged | 100 | | | | 0 | Cold 40 | Uses one action, **Toll**: every 60 Ticks, 3 physical to every Hero and 20% Slow |

### The Deep Growth, Floors 16–20: armour and Curse

The fungal growth grown thick, shelled, and feeding.

| Enemy | Row | Reach, targeting | Health | Power | Every | Damage | Armour | Resistances | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Shellcap Husk** | Front | Melee, front first | 200 | 2 | 35 Ticks | Poison | 40 | Physical 20, poison 30 | Fungal Poison stack on each hit, as the Mire Bloat. Hard to cut, easy to rot |
| **Shroud Weaver** | Back | Ranged, front first | 90 | | | | 0 | Poison 30 | Two actions: **Spore Lash**, every 30 Ticks, 3 poison to one front-Row Hero plus a 0.5 Poison stack; **Shroud**, every 90 Ticks, a 20% Curse on every Hero |

### Today's Families gain resistances

Step 1 left every enemy at 0 fire, cold, and holy resistance until now. The restless dead (Sodden Thrall, Tallow Wight, Bone Chanter) gain **cold 25**, as the Ossuary does, since the dead are cold already. Fungal growth stays as it is.

## Guardians

All 3 are automata like the first: [brass and iron among the mould](lore/bible.md#the-guardians), no dialog, a sprite from shapes. Each is written at the Warden's strength, tuned for depth 5, and scales to its own depth as the Warden does, at the same 60% Guardian strength. So the table reads against the Warden's 2,600 health, 15 armour, and its actions. Each has the Warden's XP and drops: a guaranteed rare on the first kill, then an ordinary item.

Names are [open in the bible](lore/bible.md#open-questions), so each gets 3 options. The first is the working name in code until the human picks.

### Wall 2, Floor 10: physical, on the front Row

**Names:** the Iron Sexton, the Bone-Press, the Ossuary Gate. A sexton's automaton built to stack the dead, now stacking the living.

| | Value |
|---|---|
| Health, armour, resistances | 2,800, armour 25, none |
| Row, reach | Front, melee |
| Phase 1 | **Piston Fist:** every 70 Ticks, 40 physical to one front-Row Hero. **Sweep:** every 120 Ticks, 15 physical to every Hero |
| Phase 2, from 50% health | **Piston Fist:** every 45 Ticks, 150 physical. **Hammerfall:** every 140 Ticks, 350 physical to one front-Row Hero |

The poison resistance that beat Wall 1 does nothing here. Armour and front-Row health do.

### Wall 3, Floor 15: the back Row, and Slow

**Names:** the Knell Engine, the Sluice-Warden, the Flood Bell. A bell-and-pump automaton that once rang the floodgates closed.

| | Value |
|---|---|
| Health, armour, resistances | 2,400, armour 15, cold 40 |
| Row, reach | Front, ranged |
| Phase 1 | **Knell:** every 80 Ticks, 10 physical to every Hero and 25% Slow. **Undertow:** every 70 Ticks, 45 physical to **one back-Row Hero** |
| Phase 2, from 50% health | **Knell:** every 60 Ticks, 20 physical and 40% Slow. **Undertow:** every 45 Ticks, 120 physical to one back-Row Hero |

Undertow needs a new action target, one back-Row Hero, or a front-Row one when the back Row is empty. Bar the Way already pulls single-target attacks onto the Sin-Eater, so it answers Undertow outright, and Shared Burden softens it.

### Wall 4, Floor 20: armour, and outlasting a Curse. Ends the Act

**Names:** the Reliquary Engine, the Charnel Abbot, the Sexton Prime. A reliquary on legs, its casing grown over with the deep fungus. Beating it reveals the way into the Ember Works.

| | Value |
|---|---|
| Health, armour, resistances | 3,200, armour 80, physical 20 |
| Row, reach | Front, melee |
| Phase 1 | **Censer of Spores:** every 70 Ticks, a 4 Poison stack and a 20% Curse on every Hero. **Grind:** every 60 Ticks, 25 physical to one front-Row Hero |
| Phase 2, from 40% health | **Censer of Spores:** every 60 Ticks, a 10 Poison stack and a 35% Curse. **Grind:** every 45 Ticks, 110 physical. **Reliquary Crush:** every 150 Ticks, 280 physical to one front-Row Hero |

Armour 80 and physical resistance cut a plain physical hit by more than half. Bleeds, Poison, and Burn ignore armour, and fire, cold, and holy skip it, so the answer is a damage mix. The Curse makes the fight long, so poison resistance and heals matter again.

## Building it

- **New rules:** Pack enemies with timed actions instead of a plain attack (the Drowned Bellman, the Shroud Weaver), and the one-back-Row-Hero action target. The rest uses rules already built.
- **Art:** 7 new enemy sprites and 3 Guardian sprites, from shapes, as today's are.
- **World:** each Lamp's Guardian in the built list, with the Act's 4 Lamps marked done, and the Packs rolled by band.
- **Tests:** each Family's Floors, each Guardian's phases, Undertow's target, and a Pack enemy using actions.

## Questions for the human

Answered on 2026-11-13: build as drafted.


1. **The 4 Walls' leanings:** poison, physical, back Row, armour. Or should Wall 3 lean fire instead, an Oil-burning automaton that hints at the Ember Works? That needs a fire resistance Affix, which today's gear lacks.
2. **The new rules:** the one-back-Row-Hero target, and Pack enemies with timed actions.
3. **Cold resistance on the dead,** 25 to 40, which makes Chill Word weaker in the Undercroft. Or leave fire, cold, and holy at 0.
4. **The Families:** their names, roles, and how a band rolls them.
5. **Each Guardian's name,** from its 3 options or another.
