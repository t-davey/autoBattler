# First playable: playtest

The first playable is built: [the plan](plans/first-playable.md) is done. This note is for the human playing it over a few days of check-ins, and collects every value still waiting on the human's word.

## Starting

- **Desktop:** `npm run start:electron` builds and opens the desktop app. A release is the human's to publish, as [pull requests](pull-requests.md) says.
- **Browser:** `npm run dev`. A dev build also shows Skip 1 hour and Start over.
- **A fresh Game:** saves from before 2026-11-14 load, but keep the levels they earned under the old, faster curve. Start over for a fair test. A release build has no Start over yet: ask for one if an old save is in the way.

A new Game starts in Act 1's placeholder Wilderness and reaches the Undercroft in about 4 hours of Party time. The Undercroft is what's being judged.

## What to judge

- **Coming back:** whether returning to the Away Report, its loot, and its Wall progress feels good.
- **Decisions beating Walls:** whether a choice you make, a skill, an item, a Party order, beats a Wall the Party was stuck on.
- **The pace:** each Undercroft Wall should take about 2–4 hours of Party time and a few check-ins, not fall on the first try and not stall for a day.
- **Town:** whether gold, the merchant, the gamble vendor, and rerolls give you something worth doing at each check-in.

Jot what felt good and what didn't, with the Floor and the Party, so tuning can follow.

## What tuning found

[First playable: tuning and handover](first-playable-tuning.md#what-building-found) has the measurements. In short:

- **Wall 4 leans on the Hexer.** A Party with a Hexer beats the Reliquary Engine in under an hour, and one without takes about 3. Any stronger, and Parties without a Hexer stall for 15 hours or more. It's tuned so every Party gets through, which makes it quick with a Hexer.
- **The Undercroft runs a little quick,** about 8½ hours against 12, mostly from Wall 4.
- **Salvage is plentiful:** about 280 an hour with commons auto-salvaged, so rerolls are cheap.

## Open questions

Each was built with a starting value and waits on the human's word. Answer them as play shows.

- **Battles, step 1:** crits at 150%, a 75% resistance cap, and 0 enemy resistance to fire, cold, and holy. And the [effect rules](first-playable-skills.md#effects), so they can join CONTEXT.md.
- **The Hexer, step 3:** its stats and its bone sling.
- **Names, step 5:** the name pool in `src/sim/content/names.ts`.
- **The Undercroft, step 6:** the Guardians' working names, [open in the bible](lore/bible.md#open-questions), and [the draft's questions](first-playable-undercroft.md#questions-for-the-human).
- **Gear, step 7:** the uniques' names and lines, and [the draft's questions](first-playable-gear.md#questions-for-the-human).
- **The Stash, step 8:** item value, the auto-salvage rules, and the Salvage amounts, in [the draft's questions](first-playable-stash.md#questions-for-the-human).
- **Town, step 9:** every price, in [the draft's questions](first-playable-town.md#questions-for-the-human).
- **Tuning, step 10:** what to do about Wall 4 and the Hexer: give other Classes its answer, change the Wall, or accept it. And whether rerolls should cost more Salvage.
- **Not built:** the Belt, Stance, and Elite packs. Confirm they stay out of the first playable.
