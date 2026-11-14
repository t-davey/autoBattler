# First playable: tuning and handover

A draft of step 10 of [the first playable plan](plans/first-playable.md), for the human to review: what the balance player learns, what pace the Undercroft is tuned to, which numbers move, and what the human gets to play. Nothing here is built until confirmed.

## What the design already sets

[Why a weekend](design.md#why-a-weekend) and [Skills](design.md#skills) fix these:

- The first Difficulty Tier takes about 30–40 hours of Party time. A clean pass through all 60 Floors takes about 5 hours, and each Wall about 3 hours, or 6–12 Runs.
- A Wall falls to a good Run on top of the Party's growth, not to days of farming.
- Heroes reach about level 25 by the end of the first Tier.
- The first playable is judged over a few real days of check-ins.

They leave open how the balance player plays, how Act 1's placeholders should pace, and which numbers move.

## What today measures

The `world` mode on 10 Seeds, with the Routine player checking in every 3 hours:

| Wall | Hours since the last | Level | Tries to the first kill |
|---|---|---|---|
| Act 1's 4 (placeholders) | 3.0, 0.3, 0.3, 0.7 | 10–15 | 8, 1, 1, 2 |
| Undercroft 1, poison | 1.5 | 19 | 3 |
| Undercroft 2, physical | 0.8 | 21 | 3 |
| Undercroft 3, the back Row | 0.5 | 22 | 1 |
| Undercroft 4, armour and Curse | 7.9 | 34 | 13 |
| Act 3's 4 (placeholders) | 0.3, 1.0, 4.8, 9.7 | 34–53 | 1, 1, 7, 18 |

The Tier finishes in a median 30.9 hours, inside the target, but only by luck: 11 of 12 Walls miss 2–4 hours. Two things stand out:

- **The Undercroft's first 3 Walls barely stop the Party,** then Wall 4 takes about 8 hours.
- **Heroes level about twice as fast as the design says:** level 34 at the end of the Undercroft and 53 at the end of the Tier, against about 25.

The measurement is also out of date. Its player fields only the preset Party, spends points in the first Branches only, ignores the Hexer, the second Branches, the second trinket Slot, gold, and the merchant, and never sets an auto-salvage rule. Its numbers come from a Party weaker than a real player's.

## 1. Teach the balance player the first playable

The `world` mode plays like a steady player who checks in every 3 hours and makes the obvious moves, nothing clever:

- **Every Class:** 4 Parties, each leaving out one Class, so each Class plays in 3 of them.
- **Both Branches:** each Party plays twice, once filling each Class's first Branch before its second and once the other way round, so neither Branch's numbers hide the other's.
- **Gear:** equips plain upgrades in all 6 Slots, including the second trinket, counting resistances.
- **Town:** sets the auto-salvage rule to commons, and buys any merchant item that's a plain upgrade it can afford.
- **Not:** respecs, rerolls, gambles, locks, or picking Picks by hand. Those are a player's judgment, and a target met without them leaves the player room to do better.

That is 8 Party plays per Seed. The report gives each Wall's median across all of them, and flags any Party more than half as slow again as the median, so no Class or Branch is a trap.

## 2. The pace to tune to

- **The Undercroft's 4 Walls:** each 2–4 hours of Party time after the last, about 6–12 Runs, and rarely won on the first try, so the Undercroft takes about 12 hours from its first Floor.
- **Levels:** about level 12 entering the Undercroft and about 20 at its end, on the design's line to about 25 at the end of the Tier.
- **Act 1's placeholders: kept quick,** about 4–5 hours for all 4 Walls, so the human reaches the Undercroft on the first day. At the full weekend pace Act 1 would fill the first day with placeholder Floors.
- **Act 3's placeholders:** no target. They sit past the first playable, and only need to be beatable.
- **The Tier:** no longer judged in the first playable, since 2 of its 3 Acts are placeholders.

## 3. The numbers that move

In this order, re-measuring after each:

1. **The XP curve,** to bring levels down to about 20 at the end of the Undercroft. This comes first because every Wall is tuned against the Party's level. Fewer levels means fewer skill points: about 19 by the Undercroft's end, enough to open the third skill in both Branches.
2. **Each Undercroft Guardian's strength,** its health and power, one Wall at a time. Walls 1–3 get harder and Wall 4 easier. Each keeps its leaning and its actions.
3. **The Undercroft's Packs,** only if a Wall's Floors are a clean walk or a stall. A clean pass of all 20 Floors should take about 1½–2 hours.
4. **Act 1's placeholder Guardians,** only as far as the 4–5 hour target needs.

Not moved unless the measurement shows them off: Classes, skills, Affixes, uniques, prices, and Salvage. After the Walls are tuned, the report also prints the economy's real pace, so the human can see it: gold an hour against the respec and merchant prices, Salvage an hour, when the Stash fills, and how often a unique drops. The docs' stated times are corrected wherever they've drifted.

Saves stay at `SAVE_VERSION` 10. Changing numbers doesn't break them, but a Game saved before the XP change keeps the levels it has.

## 4. Handing over

- **A playtest note,** `docs/first-playable-playtest.md`: how to start a new Game, what to judge (whether coming back to loot feels good, and whether a build decision beats a Wall), and every value still marked provisional, in one list, so the human can answer them while playing.
- **The open questions** from steps 1–9 move from the plan into that note.
- **A release** is the human's to publish, as [pull requests](pull-requests.md) says. The game is ready for one once step 10 lands. Until then, `npm run start:electron` plays the desktop build.

## Questions for the human

1. **The balance player:** every Class, both Branches, 6 Slots, commons auto-salvaged, and merchant upgrades bought, but no respecs, rerolls, or gambles.
2. **The Undercroft's pace:** each Wall 2–4 hours and rarely won on the first try, about 12 hours for the Undercroft.
3. **Levels:** slow the XP curve to about level 20 at the end of the Undercroft. Or leave levels fast and tune the Walls against today's curve?
4. **Act 1 kept quick,** about 4–5 hours, so the Undercroft starts on the first day. Or pace it to the full weekend, about 12 hours?
5. **The handover:** a playtest note collecting every open question, and a release when you choose.
