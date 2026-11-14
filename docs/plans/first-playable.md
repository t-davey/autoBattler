# The first playable: plan

Build [the first playable](../design.md#first-playable): the full loop, built thin, judged over a few real days of check-ins. The design holds the rules and [First playable skills](../first-playable-skills.md) holds the skills. This plan holds the order of work.

**Status: decided, not built.** The human chose on 2026-11-13:

- **Act 1 stays first.** A new Game starts in the placeholder Wilderness, as the [full-game skeleton](full-skeleton.md) does, and reaches the Undercroft after Act 1's 4 Walls. At the weekend pace that is about a third of the Tier, so the Undercroft is judged from the second day of check-ins.
- **The player picks the Party:** 3 Heroes from the 4 Classes, duplicates allowed.
- **Town has all of the Economy:** gold and paid respecs, Salvage rerolls, a merchant, and a gamble vendor.
- **Loot grows to the design's 6 Slots and adds uniques.** Claude drafts the 4 Class uniques and the new Slots' bases for the human to review before they're built.

The Away Report, Planning, and Stash keep their tabs, since [the Council desk](council-desk.md) is shelved.

## Today

| Area | Built | Missing for the first playable |
|---|---|---|
| Classes | Sin-Eater, Warrener, Lamplighter, as one preset Party | The Hexer, and choosing the Party |
| Skills | 9: Bulwark, Bloodletting, Hearth. 2 points per step | 19 more: the second Branches, Rot and Malediction, the 4 free Class skills. 3 points per step |
| Battles | Physical and poison, Bleed, Poison, Ward, Bar the Way | Fire, cold, and holy with their resistances. Burn, Slow, Curse, Dodge, changing Rows |
| Undercroft | Floors 1–5's Packs and the Mouldering Warden | Packs for Floors 6–20 and 3 Guardians, all placeholders today |
| Loot | 3 Slots, common to rare, Affixes | 6 Slots, uniques, a 300-item Stash with locks, auto-salvage, Salvage |
| Town | A menu with Send | Gold, paid respecs, rerolls, a merchant, a gamble vendor |

## Work, in order

Rapid prototyping: each piece lands as a commit straight on `main` and leaves the game runnable. A step that needs new design starts by drafting it for the human, and builds only once it's confirmed.

| # | Work |
|---|---|
| 1 | **Damage types and effects.** Fire, cold, and holy damage, the 5 resistances, and Burn, Slow, Curse, and Dodge as Battle rules, with tests. 3 points per step. Nothing uses the new effects yet: **done**. The effects follow [the skills draft's](../first-playable-skills.md#effects) rules. Enemy timed actions can Burn, Slow, and Curse, and any Unit can have a dodge chance, so tests and later Guardians reach them. A Burn lasts 4 seconds, a Slow 4, and a Curse 8, from the draft's first skills. Crits stay at 150% and resistances cap at 75%, as today. Every enemy has 0 fire, cold, and holy resistance until step 6. With 3 points per step, the `world` mode on 6 Seeds finishes the Tier in a median 30.5 hours, inside the target |
| 2 | **Free Class skills.** Consume Sin, Tainted Shaft, and Votive Spark for today's 3 Classes, from the first level, using no points: **done**. Each Hero's order holds its free Class skill, which starts last, and newly learned skills go just ahead of it, since it always has a target. Older saves load with it added. On 6 Seeds the Tier takes a median 36.1 hours, up from 30.5, with Act 3's placeholder Walls slower. Tainted Shaft fires at 60% from the front Row, where the Warrener usually stands. On 2026-11-13 the human chose that the order holds up to 3 learned actives, as the design says, so any can be left out: `SAVE_VERSION` 6, and version 5 saves load with the free Class skill added where there's room. A skill first learned joins the order if it has room |
| 3 | **The Hexer.** The Class with Chill Word, Rot, and Malediction, its stats, and its Battle-scene sprite. It stays out of the preset Party until step 5: **done**. Steps now count points spent in their own Branch, and Planning lists each Branch apart. A scenario's `party`, and `?party=` in a dev build, picks 3 different Classes, so tests and a dev Game can field the Hexer. Its stats are starting values for the human to review: 90 health (+9 a level), 12 power (+2), 4 armour (+1), speed 100, 5% crit, a bone sling |
| 4 | **The second Branches.** Flagellation, Fieldcraft, and Flame. Fall Back moves a Unit between Rows mid-Battle. Bar the Way, Fall Back, Shared Burden, and Bloom are the first to simplify if this runs long: **done**, all 28 drafted skills built as drafted, none simplified. Penitent Blow and Red Tithe cost health instead of Oil. Mortified Flesh counts whole 10% steps of missing health. Kindling's Burn is worth its share of what the hit dealt, and White Heat's splash neither Burns nor splashes again. The `balance` script still builds from the first Branches only, so the pace is unchanged at 36.1 hours on 6 Seeds; step 10 teaches it the rest |
| 5 | **Choosing the Party.** A new Game asks for 3 Classes, duplicates allowed, with generated names. Hero ids stop being Class ids, so `SAVE_VERSION` goes up: **done**, `SAVE_VERSION` 7, and older saves are wiped, as the human chose on 2026-11-13. A Hero's id is its Class id, numbered when the Party repeats a Class, such as `hexer-1`, and each Hero carries its Class. Names come from a provisional pool in `src/sim/content/names.ts`, drawn from the Seed. Since 2026-11-13 each new Game rolls a random Seed, as the human chose, so Parties differ in names, Floors, and loot. A dev build's `?seed=` still fixes one |
| 6 | **The Undercroft.** Draft Packs for Floors 6–20 and Guardians for Lamps 2–4, each Wall leaning on a damage type or role, for the human to review. Then build them in place of the placeholders: **done**, built as drafted in [First playable: the Undercroft](../first-playable-undercroft.md), as the human chose on 2026-11-13. Each band of 5 Floors adds a Family, rolled half the time beside the earlier ones. Pack enemies can use timed actions, and an action can target one back-Row Hero. The dead resist cold. A dev build's `?floor=` starts at any depth, with `?start=guardian` at its Guardian. On 10 Seeds the `world` mode finishes the Tier in a median 39.4 hours, but the Undercroft's Walls are uneven: Walls 2 and 3 fall in about 1 hour each, and Wall 4 takes 14, with a median 20 tries. The `balance` script still builds from the first Branches only, so step 10 retunes them with every Branch in play |
| 7 | **Gear.** Draft the off-hand, helm, and second trinket bases and the 4 Class uniques for review. Then build 6 Slots and the unique rarity: **done**, built as drafted in [First playable: gear](../first-playable-gear.md), as the human chose on 2026-11-13. A drop picks its Slot first, so trinkets come twice as often. Max Oil is a gear stat. Each unique changes its Class's free skill, only its Class may wear it, and each Undercroft Guardian drops its own on 10% of kills after the first. Equipping can name a Slot, for the second trinket. `SAVE_VERSION` 8, and version 7 saves load as they are. A scenario's `lampsLit` lights several Lamps for tests |
| 8 | **The Stash and Salvage.** A 300-item Stash with locks. When it's full, the lowest-value unlocked items are salvaged. Auto-salvage rules, and Salvage as a material |
| 9 | **Town.** Draft prices for review: gold drops, respec cost by level, reroll cost, merchant stock by Lamps lit, and gamble odds. Then build them into Town's menu |
| 10 | **Tune and hand over.** Retune the `world` balance mode for the Undercroft's 4 Walls at the weekend pace, with every Class in play. Then the human plays it over a few days |

## Questions for the human

Each comes up at the step named, and gets confirmed before that step builds it.

- **Step 1, built with defaults:** crits at 150%, a 75% resistance cap, and 0 enemy resistance to fire, cold, and holy. Confirm or change them, and confirm the [effect rules](../first-playable-skills.md#effects) so they can join CONTEXT.md.
- **Step 3, built with starting values:** the Hexer's stats and its bone sling.
- **Step 5, built with a provisional value:** the name pool.
- **Step 6, built as drafted:** the Guardians' names are working names, and the Walls' numbers wait for step 10.
- **Step 7, built as drafted:** the uniques' names and lines are provisional, and the numbers wait for step 10.
- **Step 8:** the auto-salvage presets, and how an item's value is measured.
- **Step 9:** every price.
- **Not in this plan:** the Belt, Stance, and Elite packs. Confirm they stay out of the first playable.
