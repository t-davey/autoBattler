# Milestone 4: Loot and gear

**PR title:** `feat: add loot, Affixes, and a Stash with manual equip`

**Issue:** [#8](https://github.com/t-davey/autoBattler/issues/8)

**ADRs:** 0001 seeded loot; 0003 list rendering.

**Needs:** [gaps](gaps.md) G14, G21, G22, plus S3 if R3 trips.

**Create**

- `src/sim/items.ts`, `src/sim/content/items.ts`, `src/sim/items.test.ts`
- `src/ui/StashTab.tsx`, `stashQuery.ts`, `stashQuery.test.ts`

**Change**

- `src/sim/run.ts`, `src/sim/game.ts`, `src/sim/view.ts`, `src/sim/index.ts`
- `src/sim/content/party.ts`: the starter weapons become items.
- `src/ui/App.tsx`, `PlanningTab.tsx`, `describeEvent.ts`
- `scripts/balance.mjs`: add a `drops` mode.

**Sim rules**

- **Slots:** weapon, body, trinket. Any Hero can equip any item that meets its level requirement.
- **Weapon reach:** G14. Equipping a weapon that blocks a learned skill is allowed, and the skill stops being available.
- **Starter gear:** Sin-Eater Iron Cudgel, Huntsman Flensing Knife, Lamplighter Bone Sling, all common. No body or trinket. These replace M2's constant.

| Base | Slot | Reach | Built in |
|---|---|---|---|
| Iron Cudgel | Weapon | Melee | +4 power |
| Flensing Knife | Weapon | Melee | +3 power, +2% crit |
| Bone Sling | Weapon | Ranged | +3 power |
| Rust Mail | Body | | +8 armour |
| Waxed Shroud | Body | | +4 armour, +8% poison resistance |
| Saint's Knuckle | Trinket | | none |

- **Rarity by Floor** (common / magic / rare): 80/18/2, 72/23/5, 62/28/10.
- **Affixes:** common 0, magic 1–2, rare 3–4, with no repeats on one item. Values roll in the range below, scaled by Floor (× 1.0, 1.2, 1.4), and round to whole numbers.

| Affix | Effect | Range |
|---|---|---|
| Keen | +power | 1–4 |
| Hale | +max health | 10–30 |
| Iron-bound | +armour | 4–12 |
| Sallow | +poison resistance | 6–15% |
| Cruel | +critical chance | 2–6% |
| Swift | +speed | 3–8 |

- **Level requirement:** Floor 1: level 1. Floor 2: level 3. Floor 3: level 4. A rare adds 1.
- **Drops:** a chest holds an item 60% of the time, a Battle 10%, and a Guardian kill always. This gives about 32 items and 1.8 rares an hour.
- **First Guardian kill:** the drop is always rare, once per Game, whatever the Rarity roll.
- **Stash:** loot lands there straight away, with no limit. Equipping swaps the old item back into it.

**Tests**

- `the same Seed produces the same items`
- `items roll Affix counts by rarity with no repeats`
- `Rarity odds match each Floor's table across many Seeds`
- `a chest, a Battle, and a Guardian kill can each add an item to the Stash`
- `the first Guardian kill drops a rare, and later kills may not`
- `equipItem is refused below the level requirement`
- `equipItem swaps the old item back into the Stash`
- `equipping an item during fallback resumes Guardian attempts`
- `unequipItem returns the item to the Stash`
- `equipped gear changes a Hero's stats in the next Battle`
- `removing a Hale item clamps health to the lower maximum`
- `a Sallow item reduces Poison damage in Battle`
- `a ranged weapon makes melee skills unavailable`
- `an unknown itemId is refused and changes nothing`
- `serializeGame round-trips a Game with items`
- In `src/ui/stashQuery.test.ts`: `sorts by newest, rarity, and level requirement`, and `filters by slot, rarity, and Affix`

Sort and filter live in `src/ui/stashQuery.ts`: they are presentation, with no effect on rules.

**In `npm run dev`:** items appear in the Live Log, coloured by rarity, as they drop. The Stash tab sorts and filters, including by "poison resistance". Equipped gear sits beside the list for manual comparison, with no upgrade button, as the design says. Equip a Sallow item and the Hero's poison resistance rises on its stat sheet.

**`npm run smoke:electron`:** not required.

**`CONTEXT.md`:** add **Item**, **Rarity**, **Slot**, **Level requirement**.

**Acceptance:** `npm run check` passes. `npm run balance -- drops` prints the [R3](risks.md#r3-6-affixes-make-drops-feel-samey) table and the threshold passes, or S3 has settled it. In the running app, a `?start=guardian&level=40` Party's first kill puts a rare in the Stash, and equipping it changes the stat sheet.
