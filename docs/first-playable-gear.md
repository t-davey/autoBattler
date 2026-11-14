# First playable: gear

The bases for the 3 new Slots and the 4 Class uniques. The human chose to build it as drafted on 2026-11-13, so the questions below were answered with the draft's own choices, and step 7 of [the first playable plan](plans/first-playable.md) built it. Every name and number is a starting value, and step 10 tunes them. The uniques' names and lines are provisional, as [the lore rules](lore/README.md#status) mark anything the human hasn't chosen.

## The shape

[Gear](design.md#gear) gives each Hero 6 Slots: weapon, off-hand, helm, body, and two trinkets. Today's game has weapon, body, and one trinket. This draft adds the off-hand and the helm, and a second trinket Slot that takes the same bases as the first.

- **Any weapon goes with any off-hand.** No two-handed weapons in the first playable, so a Hero simply has both.
- **Every Affix rolls on every base,** as today.
- **A new Hero starts with only its weapon,** as today. The new Slots fill from loot.
- **A drop picks its Slot first,** evenly across the 6, so trinkets drop twice as often as any other Slot. Then it picks a base in that Slot. Today a drop picks evenly across all bases, which would tilt loot towards whichever Slot has the most bases.
- **Saves keep loading.** A Hero's trinket moves to the first trinket Slot.

## Bases

Stats are base values, as today's built-in stats are. For scale, today's bases give power 3–4 on a weapon, armour 8 on Rust Mail, and armour 4 plus poison resistance 8 on the Waxed Shroud.

### Off-hand

| Base | Built in | Notes |
|---|---|---|
| **Coffin-Lid Buckler** | Armour 5 | For the front Row |
| **Bone Censer** | Power 2 | For anyone who deals damage |
| **Spare Lantern** | Max Oil 15 | For skill-heavy builds. Max Oil isn't on gear yet: see [question 2](#questions-for-the-human) |

### Helm

| Base | Built in | Notes |
|---|---|---|
| **Iron Skullcap** | Armour 5 | |
| **Mourner's Hood** | Health 15 | |
| **Mould Mask** | Armour 2, poison resistance 6 | A smaller Waxed Shroud, for Wall 1 and the Deep Growth |

### Trinket, both Slots

| Base | Built in | Notes |
|---|---|---|
| **Saint's Knuckle** | Nothing | Today's trinket. Never drops as a common, as now |
| **Bone Dice** | Critical chance 2 | |
| **Spigot Key** | Speed 3 | A key for the Undercroft's Oil spigots |

## Uniques

Each Class gets one unique that only it can equip, as [the first playable](design.md#first-playable) asks. Each one changes the Class's **free skill**, since every Hero of that Class has it whatever Branch it takes, so the unique never depends on a build. The change shows in the Battle: a skill that hits more enemies, fires twice, or heals.

A unique has fixed stats and no Affixes. Its stats scale with the Floor it dropped on, as Affixes do, and its level requirement is the Floor's, as a magic item's is. Its name shows in its own colour.

| Unique | Class | Slot | Built in | Changes |
|---|---|---|---|---|
| **The Wake Platter** | Sin-Eater | Off-hand | Armour 6, health 20 | **Consume Sin** strikes every enemy in the front Row for 90% of power each, instead of one for 110%, and heals 3% of max health for each enemy hit |
| **The Ratter's Quiver** | Warrener | Off-hand | Power 2, speed 4 | **Tainted Shaft** looses 2 shafts, each at full strength, at 2 different enemies when 2 live |
| **The Layer-Out's Coif** | Hexer | Helm | Health 15, power 2 | **Chill Word's** Slow rises from 15% to 25% and reaches every enemy in the target's Row, which also take 50% of its damage |
| **The Dusk Taper** | Lamplighter | Trinket | Power 2, critical chance 3 | **Votive Spark** also heals the Hero with the lowest health percentage for 60% of the damage it dealt |

### Their lines

One line each, from [the channel budget](lore/README.md#channel-budget). Each reads as mood first and as evidence once the player suspects [the Rendering](lore/bible.md#the-core-truth).

- **The Wake Platter:** "Worn bright where the bread sat on the chest of the dead. Whatever it took up, it wasn't only crumbs."
- **The Ratter's Quiver:** "Stitched from cellar-rat hide. The shafts come out smelling of the warren, which is the point." The Warrener's is [the one honest job](lore/bible.md#the-classes), so its line has no second reading.
- **The Layer-Out's Coif:** "Linen stiff with grave-salt. A layer-out wore it to keep the dead from spoiling before they were collected."
- **The Dusk Taper:** "The taper that lights Town's lamps at dusk. It burns cleanest on the evening supply."

### Where they drop

[Specific Guardians favour specific uniques](design.md#loot-sources). Each Undercroft Guardian holds one: after the first kill's guaranteed rare, each kill has a **10%** chance to drop its unique in place of the ordinary item.

| Guardian | Floor | Holds | Why |
|---|---|---|---|
| The Mouldering Warden | 5 | The Layer-Out's Coif | A Hexer's Slow helps against the first Wall |
| The Iron Sexton | 10 | The Wake Platter | Armour and a front-Row heal answer the Sexton |
| The Knell Engine | 15 | The Ratter's Quiver | Speed answers its Slow |
| The Reliquary Engine | 20 | The Dusk Taper | Holy damage skips its armour, and heals outlast its Curse |

A unique for a Class the Party lacks still drops, and waits in the Stash for a later Party. At 10% a kill, a Party farming one Guardian finds its unique in about 10 kills.

## Building it

- **Slots:** 6 equip positions, with off-hand and helm as new kinds and the trinket kind taking 2. The Hero panel shows all 6, and comparing an item shows its stat changes against the matching Slot, or against both trinkets.
- **Rarity:** unique joins common, magic, and rare, in a new colour, with Class-only equipping.
- **Skills:** each free skill checks for its Class's unique.
- **Saves:** `SAVE_VERSION` 8, with version 7 saves migrated, not wiped.
- **Words:** CONTEXT.md's Rarity and Slot entries grow, and Unique joins them.
- **Tests:** each unique's change through `simulateBattle` or a Game, Class-only equipping, the Slot-first drop, and the save migration.

## Questions for the human

Answered on 2026-11-13: build as drafted. Max Oil is a gear stat, no new resistances join the Affixes, and a unique for a Class the Party lacks still drops.

1. **The bases:** their names, stats, and the 3 per Slot.
2. **Max Oil on gear,** for the Spare Lantern. The design lists Oil as a stat, but gear doesn't give it yet. Or the Spare Lantern becomes a second power base.
3. **No new resistances on gear yet.** Fire, cold, holy, and physical resistance exist in Battles, but no Undercroft Wall leans on them. Add them as Affixes now, or leave them for Act 3.
4. **Uniques change the free skill.** Or each changes a Branch skill instead, which would push a Hero towards that Branch.
5. **Each unique's change and stats.**
6. **The drops:** each Guardian holding one unique, at 10% a kill after the first. And whether a unique for a Class the Party lacks should drop at all.
7. **The names and lines.**
