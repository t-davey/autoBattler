# Lore

How the game's story gets developed, and where it lives. **Spoilers throughout:** this folder holds the Rendering, the truth the game is built to reveal.

The human owns the canon. Terms are defined in [CONTEXT.md](../../CONTEXT.md), and [docs/design.md](../design.md) sets what the story may not do to the rules.

## Files

| File | Holds |
|---|---|
| [bible.md](bible.md) | What is true in the world, marked by status, plus the open questions |
| [act-1-fragments.md](act-1-fragments.md) | Draft Fragments for the Undercroft |

Add a fragments file for an Act when its turn comes.

## Status

Facts in the bible and lines in the fragments files carry one of these:

- **Canon:** the human confirmed it. Change it only with the human.
- **Provisional:** proposed and usable as a working assumption, but not confirmed.
- **Open:** undecided. Bring 2–3 options to the human rather than settling it in passing.

## Direction

**Canon:** fragments with one big reveal, with strong emphasis on atmosphere. Check-ins last a few minutes, so no single text has to carry the story, and a player who skips all of it loses nothing but the mood.

## Strategy

**Provisional.**

1. **Settle the core truth.** Done: [the Rendering](bible.md#the-core-truth).
2. **Turn game rules into story hooks.** Give each odd rule an in-world reason, so the story and the systems argue the same thing. In progress: see [Rules as story](bible.md#rules-as-story).
3. **Keep the bible short.** It records decisions, and the prose lives in the fragments files.
4. **Budget words by channel.** See below.
5. **Write Act 1 fully, then test it.** Friends' reactions over a few days of real Check-ins shape Acts 2 and 3. Hold off on detailed writing for later Acts until then.
6. **Consider a turn at later Difficulty Tiers.** The reset into the second could change what the replay means. This depends on [where the reveal lands](bible.md#open-questions).

The demo doesn't wait on any of this. Its chest lines are provisional ([G33](../plans/poc-demo/gaps.md)) and can use Fragments once they are ready, and anything more, such as a Guardian's line, is a demo scope change for the human to confirm.

## Writing rules

**Provisional.**

- **Two readings.** A line works as mood on first read and as evidence once the player suspects the truth.
- **Physical detail.** Smell, grease, soot, ledgers, and tins carry the story. Nobody explains it.
- **Short.** One line where one line will do, and never more than a few sentences.
- **Saved for the reveal.** What Oil is gets said outright only there.
- **Any Party.** A line works for any trio of Classes, since a Party may not hold the Class a line names.
- **The rules stand.** The story stays flavour, as [World](../design.md#world) requires.
- **Stay original.** A dying flame and a rising dark sit close to *Dark Souls*. Lean on Oil and the physical detail of rendering, and avoid fire-linking or age-of-dark framing.

## Channel budget

**Provisional**, for the first Difficulty Tier. Giving Guardians lines extends the "boss lines" in [docs/design.md](../design.md#world), and enemy descriptions aren't a channel yet.

| Channel | Amount | Job |
|---|---|---|
| Act introductions | 3, a few sentences each | Set the place and the question |
| Guardian and Boss lines | 12 Walls, 1–2 lines each | Main story beats, about one every 3 Check-ins |
| Item descriptions | One line, uniques first | Optional deeper lore |
| Away Report and Room lines | A small pool per Act | Atmosphere and hints that repay attention |

## Working together

Claude drafts options and the human chooses. Only the human's choices become canon, and each one gets recorded in the bible when it's made. A concept that settles and is used in code or docs also goes in `CONTEXT.md`.
