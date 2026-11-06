# Second Wall: plan

The [proof-of-concept demo](poc-demo.md) answered its question with yes, but it holds about an hour of game: [after the first Wall falls, nothing threatens the Party again](poc-demo-results.md#after-the-verdict-12-hours-of-play). This slice tests the next question: **does the loop still hold when a player meets a second Wall, needing a different answer, over several days of real check-ins?**

**Status: decided, not built.** The human made the decisions below on 2026-11-06. Only the Wall module and the check-in measurement are done. Some questions stay [open](#still-open), including parts of falling back. Where this plan differs from [the demo plan](poc-demo.md), this plan applies.

## Decisions

Numbered with [the demo's gaps](poc-demo/gaps.md), where each has its row.

| # | Decision | What it means |
|---|---|---|
| G40 | **A Wall takes 2–3 check-ins, tuned to an 8-hour gap and tested at 4 and 12 hours.** | Replaces the demo's 1–2 hours of Party time. At 8 hours, a first kill after the 2nd or 3rd check-in lands at 16–32 hours of Party time, around the design's roughly 25 hours per Wall (about 300 hours across 12 Walls). |
| G41 | **Test speed: 2x, 5x, and 10x, for friends too.** | Walls now take too long to rehearse live. See [Test speed](#test-speed). |
| G42 | **The second Guardian starts as placeholders.** | The human fills in [its sheet](#second-guardian) before it's built. |
| G43 | **Falling back follows the design.** | After 3 Setbacks, the Party falls back one Lamp and farms there, as [Setbacks](../design.md#setbacks) says. |
| G44 | **XP falloff comes into the demo.** | Replaces G17. As [the design](../design.md#party-and-heroes) says, XP falls off on Floors well below a Hero's level. The human picked [option B](#xp-falloff-options): full XP up to Floor level + 1, then 25% less per level, down to 10%. |

## Work, in order

Each is its own PR and leaves the demo runnable.

| # | Work | State |
|---|---|---|
| 1 | Make the Wall a module | Merged in [PR #33](https://github.com/t-davey/autoBattler/pull/33) |
| 2 | Balance players who check in on a schedule: `npm run balance -- checkins`, with [its baseline](poc-demo-results.md#check-in-baseline) | Added with this plan |
| 3 | Test speed | Not started |
| 4 | XP falloff, as [option B](#xp-falloff-options) | Not started |
| 5 | Floors 4–6, the second Guardian and Lamp, and falling back between Lamps | Not started; needs the Guardian sheet |
| 6 | Tune both Walls to the new target, then search for a new demo Seed | Not started |
| 7 | Change the weak skills found in [the results](poc-demo-results.md#findings-for-the-human), if the human chooses to | Not started; [still open](#still-open) |

Step 2 comes first so that each balance PR can show its numbers before and after, because the old targets can't see the problem. Step 7 comes last because Bulwark can only be judged against a Wall where armour matters.

## Test speed

A control that runs live play at 1x, 2x, 5x, or 10x, so a tester can watch a whole Wall without jumping past it. The human chose those speeds, and that friends testing the demo get it too.

The rest is proposed, for the human to change:

- **In builds,** so it sits in the Battle screen's header rather than in `DevTools.tsx`, which builds leave out. "Skip 1 hour" stays development-only. Test speed stands in for the design's optional 2x until balance holds up.
- **The sim doesn't change.** `driver.ts` owns the clock and can multiply the time it passes to `store.advance`. The sim already [runs the same Ticks however time is sliced](poc-demo/risks.md#r1-12-hours-of-catch-up-blocks-the-ui).
- **Multiply after the catch-up check,** so a sped-up step isn't mistaken for an absence of 60 seconds or more (G19).
- **Absences stay real time.** Catch-up, and the time a check-in pauses, run at 1x whatever the speed. So does a gap under 60 seconds after a hidden window, which `store.advance` plays live, so only steps while the window shows get multiplied.
- **The Battle scene should keep animating.** At 10x, the driver sends 10 Ticks per step, under the 20 that make the scene jump to the result. Whether 10x stays readable has to be seen in the running app.
- **Each launch starts at 1x,** and the choice isn't saved.

## XP falloff options

**The human picked option B on 2026-11-06.** These are starting values to tune. Falloff needs Floor levels, which the demo lacks, so all of these suppose **Floor level = Floor number + 3**: Floors 1–3 are levels 4–6, and Floors 4–6 would be levels 7–9. The tests also assumed a kill's Guardian XP falls off like its Floor's Battle XP. "−25% a level" takes 25 points off 100% for each level past the grace, so B reaches its 10% minimum at 4 levels past it. Option C halves instead. The XP falloff PR re-measures B on 200 Seeds with a mode in the repo.

Measured on 2026-11-06 with a throwaway script that isn't in the repo: 30 Seeds, 24 hours, first Wall only, and a player who spends points in step order and equips plain upgrades every 8 hours.

| Option | Full XP up to | Then | Minimum | Level at 24 h, untended | Untended kills by 12 h / 24 h | First kill with 8-hour check-ins |
|---|---|---|---|---|---|---|
| None (today) | Any level | | 100% | 22 | 100% / 100% | Before the 1st: 100% |
| A: gentle | Floor level + 2 | −20% a level | 20% | 14 | 100% / 100% | Before the 1st: 100% |
| **B: firm (picked)** | Floor level + 1 | −25% a level | 10% | 12 | 60% / 100% | Before the 1st: 27%. After it: 73% |
| C: halving | Floor level + 1 | Half each level | 5% | 11 | 60% / 100% | After the 1st: 100% |
| B, with a 1,600-health Guardian | Floor level + 1 | −25% a level | 10% | 12 | 0% / 0% | After the 1st: 100% |
| B, with a 2,200-health Guardian | Floor level + 1 | −25% a level | 10% | 12 | 0% / 0% | After the 1st: 100% |

- **Why B was suggested:** A leaves levels beating the Wall on their own. C holds about as well as B, but a fallen-back Party levels more slowly once it reaches its 5% minimum, and a level-up is one of the two things that end a fallback. On B, the Party gains about a level every 12 hours by level 11–12.
- **Falloff doesn't reach 2–3 check-ins alone.** Paired with more Guardian health, B stops an untended Party for the whole 24 hours, but the first check-in still wins. It spends about 10 points and 8 hours of gear at once. Getting to the 2nd or 3rd check-in is step 6's job: more Guardian health or a sharper need for the answer, or fewer drops that help.
- **Not tested:** Floors 4–6, falling back with 2 Lamps, or a player who hunts for the answer.

## Second Guardian

Every field is for the human to fill in. "Fixed" marks what the design or lore already settles. Suggestions are starting points, not decisions.

| Field | Value | Notes |
|---|---|---|
| **Name** | _TBD_ | Open in [the bible](../lore/bible.md#open-questions). The first Guardian's name is also a stand-in, and has left the lore. |
| **Look** | _TBD_ | Fixed: an automaton, gothic and steampunk, powered by Oil, with [brass and iron among the mould](../lore/bible.md#the-guardians) (that last part Provisional). No dialog. |
| **Sprite** | _TBD_ | Generated from shapes in `src/ui/battleScene`, as the first Guardian's is. |
| **Place** | Floor 6's Guardian Room | Fixed: a Lamp every 3 Floors. |
| **Damage lean** | _TBD_ | Fixed: Undercroft enemies lean physical and poison. Suggestion: physical, so armour and Bulwark matter and the first Wall's poison gear isn't enough. |
| **The answer** | _TBD_ | The stat or role that beats it, which never requires a specific Class. Physical resistance isn't on any item yet, so a physical lean's answers today are armour and health. |
| **Health** | _TBD_ | For scale, the first Guardian has 1,100. |
| **Armour** | _TBD_ | First Guardian: 15. |
| **Resistances** | _TBD_ | First Guardian: none. |
| **Row, Reach, Targeting** | _TBD_ | First Guardian: front, melee, front Row first. |
| **Action 1** | _TBD_ | Name, interval in Ticks, target (one front-Row Hero or every Hero), damage, Damage type, any Poison stack. First Guardian: Spore Breath, 60 Ticks, every Hero, 3 Poison stacks. |
| **Action 2** | _TBD_ | First Guardian: Grave Slam, 80 Ticks, one front-Row Hero, 12 physical. |
| **Further actions** | _TBD_ | None, or a mechanic the first Guardian lacks. A new mechanic may need a rule. |
| **XP for a kill** | _TBD_ | First Guardian: 100. |
| **First-kill reward** | A guaranteed rare | Fixed. _TBD:_ whether it favours items that help with the next stretch. |
| **Drops after that** | _TBD_ | First Guardian: one ordinary item from its Floor's table. |

## What Floors 4–6 need

These are starting values to propose when step 5 begins, for the human to confirm (G21):

- **By Floor:** enemy and Poison scale, Battle XP, Rarity odds, Affix scale, and level requirements. All of them stop at Floor 3 today.
- **Enemies:** whether Floors 4–6 scale the same 2 Families or add one.
- **The Wall:** one Lamp's state becomes one for each Guardian, with a save check beside it.
- **Saves:** whether old saves still load. If they don't, the PR title takes a `!`.

## Still open

The human decides these. Each suggestion is only a starting point.

1. **Levelling speed.** The Party reaches level 18 in 12 hours, while the design expects about level 25 by the end of a roughly 300-hour Difficulty Tier. Falloff alone may not close that gap, so the XP curve or Battle XP may have to change too.
2. **Where a Run starts after falling back.** Suggestion, following the design: from the first Lamp while fallen back, with its Guardian in the farm since it's beaten, then from the last lit Lamp when the Party retries.
3. **Falling back at the first Wall.** No earlier Lamp exists, so G2's rule would stay: Runs start at Floor 1 and turn back before the Guardian Room.
4. **After the last Lamp.** The demo has no Floor 7. Suggestion: repeat Floors 4–6, as G10 does for Floors 1–3.
5. **The weak skills.** The Long Cut, Bar the Way, and Warm Hands: whether to change numbers or rules, and when. Choosing a Stance and a Lamp stay cut unless the human adds them.

## Targets to replace

[The M6 targets](poc-demo-results.md#targets) measure a player who acts once at minute 60. These replace the ones that assume that. `npm run balance -- checkins` measures the first two, whose 10% and 80% carry over from the M6 targets and are the human's to change. `npm run balance -- wall` keeps its old targets until XP falloff breaks them, and that PR retires them.

- **Untended:** at most 10% of Seeds beat a Wall within a full 12-hour absence.
- **A player with the answer, at the 8-hour gap:** at least 80% of Seeds make the first kill after the 2nd or 3rd check-in.
- **Routine play, not measured as a target:** finding 1 of the results shows plain upgrades beat the first Wall without looking for the answer. Whether that's acceptable, and how long it should take, is for the human to set.
- **Second Wall:** the first Wall's answer alone doesn't beat it.

The Battle, Floor, early Wipe, and first rare targets stay.
