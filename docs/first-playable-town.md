# First playable: Town's prices

Gold, respec cost, Salvage rerolls, the merchant, and the gamble vendor. The human chose to build it as drafted on 2026-11-13, so the questions below were answered with the draft's own choices, and step 9 of [the first playable plan](plans/first-playable.md) built it. Every number is a starting value, and step 10 tunes them.

**Correction, found while building:** the draft misread its pace measurement by a factor of 5. A Party wins about 105 Battles an hour, not 21. On 2026-11-14 the human chose to raise every gold price 5 times, so each costs the time the draft meant. The prices and pace below are the corrected ones.

## What the design already sets

[Skills](design.md#skills) and [Economy](design.md#economy) fix these:

- Respecs cost gold, rising gently with level, and stay cheap to encourage experimenting.
- Salvage rerolls a single Affix on an item.
- Gold pays for respecs, a merchant, and a gamble vendor selling mystery items.
- Town is a menu, not a place. Relit Lamps improve the merchant's stock and the gamble vendor.
- A Wipe costs no gold.

They leave open how gold drops, every price, how a reroll works, and what the merchant and gamble vendor offer.

## The pace it has to fit

Today a Party wins about **105 Battles and opens 45 chests an hour** of Party time, kills a Guardian 1–3 times an hour while it farms a relit Lamp, and passes through Town about every 20 minutes. Heroes reach about level 11 by hour 5 and level 17 by hour 30.

## Town is open any time

Town is a menu, so its shops open from a Town tab whether the Party is in Town or out on a Run, as the Stash already does. Otherwise a player checking in mid-Run would rarely find them. The merchant's stock still changes only when the Party passes through Town. Spending gold mid-Run takes effect at the next Battle, as equipping does.

## Gold

Gold scales with depth through one number, a Battle's worth at that depth: **5 + depth.** That is 6 gold on Floor 1, 30 in the Undercroft's first Floor (depth 25), and 45 at its last (depth 40).

| Source | Gold |
|---|---|
| A Battle won | 1 Battle's worth |
| A chest | 3 Battles' worth |
| A Guardian | 10 Battles' worth |

That comes to about **250 Battles' worth an hour**: about 2,500 gold an hour on Floor 5, 7,500 at depth 25, and 11,000 at depth 40. The first game hour gives about 1,600. The Party's gold is one count, shown in Town and the header. It needs no material of its own.

## Respecs

**50 gold per Hero level,** so 500 at level 10 and 1,000 at level 20. That is about 10 minutes of gold at any point in the Tier, since level and depth rise together.

## Rerolls

A reroll spends Salvage to change one Affix on an item in the Stash or on a Hero:

- The player picks the Affix. It becomes a random Affix the item doesn't have, with a new value.
- The value rolls at the item's depth, read from its level requirement, so an old item stays old.
- A common has no Affix to reroll, and a unique has none.
- Locked items can be rerolled. A lock only keeps them from salvage.

| Rarity | Salvage per reroll |
|---|---|
| Magic | 5 |
| Rare | 15 |

With the Stash full, Salvage comes in at about 60–100 an hour, so a player can reroll a rare 4–6 times an hour. Before the Stash fills, it comes only from the auto-salvage rule and salvaging by hand.

## The merchant

Sells items rolled at **the depth of the deepest relit Lamp**, or Floor 1 before any Lamp is relit. A new Lamp improves its stock at once.

| | Value |
|---|---|
| Stock | 4 items, plus 1 for every 2 Lamps relit, up to 10 |
| Rarity | Magic or rare. Rare is 20%, plus 5% a Lamp relit, up to 60% |
| Price | Magic: 150 Battles' worth at the item's depth. Rare: 400 |
| Changes | Each time the Party passes through Town |

A rare costs about 1½ hours of gold and a magic about 35 minutes. Stock is one of each Slot kind first, then random, so every Slot has a chance. Uniques are never sold.

## The gamble vendor

The player picks a Slot and pays for a hidden item of that Slot, rolled at the depth of the deepest relit Lamp, which lands in the Stash.

| | Value |
|---|---|
| Price | 125 Battles' worth at that depth |
| Odds | Magic 70%, rare 28%, unique 2% |
| Better with Lamps | Rare gains 2% a Lamp relit, taken from magic, up to 50% |
| Uniques | Only one whose Guardian's Lamp is relit, and that fits the Slot. Otherwise the roll is a rare |

A gamble costs a little less than a merchant's magic and is a rare more than a quarter of the time, so it's the cheaper way to fish for one Slot. The merchant is the sure way to buy a known item. The unique chance gives Parties a second way to find a unique for a Class the Party lacked when its Guardian dropped one.

## Building it

- **Sim:** gold drops and the gold count, respec cost, rerolls, the merchant's stock and buying, and gambling, as player actions with refusals such as not enough gold.
- **UI:** a Town tab with the merchant, the gamble vendor, and rerolls. Gold in the header and Town, and the respec cost on the respec button. A reroll from the Stash's comparison too.
- **Away Report:** gold earned joins the loot Finding.
- **Saves:** `SAVE_VERSION` 10. Older saves load with 0 gold and an empty merchant, which stocks at the next pass through Town.
- **Words:** Gold, Reroll, Merchant, and Gamble join CONTEXT.md.
- **Tests:** gold by source and depth, respec cost, a reroll's new Affix and depth, the merchant's stock by Lamps, gamble odds and its unique rule, and refusals.

## Questions for the human

Answered on 2026-11-13: build as drafted. On 2026-11-14, after the pace correction above, the human chose to raise the prices 5 times.

1. **Town open any time,** not only while the Party is in Town.
2. **Gold:** 5 + depth per Battle, with chests at 3 and Guardians at 10.
3. **Respec cost:** 10 gold per Hero level, raised to 50.
4. **Rerolls:** the picked Affix becomes a different Affix, at the item's depth, for 5 or 15 Salvage. Or should it keep its kind and only reroll the value?
5. **The merchant:** its stock, rare share, and prices.
6. **The gamble vendor:** its price, odds, and selling uniques at 2%.
