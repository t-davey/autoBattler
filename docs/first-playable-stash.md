# First playable: the Stash and Salvage

A draft of the Stash's cap, locks, auto-salvage, and Salvage, for the human to review. Step 8 of [the first playable plan](plans/first-playable.md) builds it once confirmed. Every number is a starting value, and step 10 tunes them. Spending Salvage on rerolls is step 9's, with its price.

## What the design already sets

[Runs](design.md#runs) and [Gear](design.md#gear) fix these:

- The Stash holds 300 items, each taking one space.
- The player can lock items.
- When the Stash is full, the lowest-value unlocked items are salvaged.
- Auto-salvage rules exist from day one.
- Salvage is a material, and it rerolls a single Affix on an item.

They leave open how an item's value is measured, which auto-salvage rules exist, and how much Salvage an item gives.

## The pace it has to handle

Today a Game finds about **55 items an hour** of Party time: about 34 commons, 16 magics, and 8 rares, steady across the Tier. That is about 2,200 items over the 40-hour Tier. With no rules, the Stash fills in about **5½ hours**, before the end of Act 1. After that, the cap salvages an item for nearly every item found.

## Item value

A single number that ranks items, so the cap knows which go first. It has to be easy to read in the Stash and never claim one item is better for a Hero, which [comparing](design.md#gear) leaves to the player.

**Value = level requirement + a rarity bonus:** common +0, magic +5, rare +10.

- Level requirement stands for the depth the item came from, so older finds go before newer ones of the same rarity.
- The rarity bonus keeps a rare ahead of a magic from about 5 Floors deeper.
- Ties go to the older item first.
- **Uniques are never salvaged by the cap or by rules,** only by hand. There are 4, and each Guardian holds only one.

The value isn't shown as a number. The Stash's existing sort by rarity and by level already shows the same order.

## Locks

- A lock is on one item, and it survives equipping and unequipping.
- The Stash locks and unlocks a whole group of identical items at once, since it lists them as one.
- Locked items still take space. The cap and auto-salvage skip them.
- If the Stash is full of locked items, a new item is salvaged as it lands.
- Equipped items aren't in the Stash, so they never count and are never salvaged.

## Auto-salvage

One Party-wide rule, set in the Stash, that salvages items as they land. The cap still applies on top of it.

| Rule | Salvages on arrival |
|---|---|
| **Keep everything** (the default) | Nothing |
| **Salvage commons** | Commons |
| **Salvage commons and magics** | Commons and magics |

Keep everything is the default, since early commons fill the new Slots. A player who sets a rule changes what fills the Stash: at Salvage commons it fills in about 13 hours, and at commons and magics, in about 37.

**A keep-stat exception:** any rule can also keep items with one chosen stat, such as poison resistance, whatever their rarity. It matches how a check-in's Finding points at a stat, so the item a Wall asks for doesn't vanish. Off by default.

## Salvage

| Rarity | Salvage |
|---|---|
| Common | 1 |
| Magic | 3 |
| Rare | 8 |
| Unique | 20 |

- The Party's Salvage is one count, shown in the Stash and in Town.
- **Salvaging by hand:** the Stash can salvage the picked item, or its whole group, and asks first for a rare or a unique.
- At today's pace, with Keep everything, a full Stash gives about 110 Salvage an hour. Step 9 prices rerolls against that.

## The Away Report

The loot Finding adds what was salvaged, such as "Loot: 34 common, 16 magic, 8 rare. 40 salvaged for 70 Salvage." A rare salvaged by the cap is named, so the player sees what the full Stash cost them.

## Building it

- **Sim:** the cap, value, locks, the rule and its keep-stat, Salvage, and salvaging by hand, as player actions with refusals.
- **UI:** a lock on each Stash row and in the comparison, a salvage button, the rule and Salvage count in the Stash's header, and Salvage in Town.
- **Saves:** `SAVE_VERSION` 9. Version 8 saves load with 0 Salvage, Keep everything, and nothing locked. A Stash already over 300 trims at the next drop.
- **Words:** Lock and Auto-salvage rule join CONTEXT.md.
- **Tests:** the cap's order, locks, each rule and the keep-stat, Salvage amounts, the unique exception, and the save migration.

## Questions for the human

1. **Item value:** level requirement plus a rarity bonus of 0, 5, or 10, with uniques exempt.
2. **The rules:** the 3 presets, Keep everything as the default, and the keep-stat exception.
3. **Salvage amounts:** 1, 3, 8, and 20 by rarity.
4. **Locks on groups:** locking a group of identical items locks every copy.
5. **Asking before a hand salvage** of a rare or unique.
