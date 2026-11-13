# The Council desk: plan (shelved)

Build [the Council desk](ui-style.md#the-council-desk) into the game, in place of the Away Report, Planning, and Stash tabs. [The mockup](../../mockups/council-desk.html) runs on a real game and settles the look. This plan holds the order of work, and [the UI style plan](ui-style.md) holds the style.

**Status: shelved, not going ahead.** On 2026-11-13 the human chose to keep the Away Report, Planning, and Stash tabs as they are. [The mockup](../../mockups/council-desk.html) stays as a design reference for its art and lessons. Nothing in this plan is to be built unless the human revives it.

Earlier, on 2026-11-11, the human had chosen the desk, the lid, Hero marks on tags, and busts.

## What carries over from the mockup

- **Painted elements:** each draws its own canvas in art pixels, from the Battle scene's ramps. A canvas fills its element exactly and never overhangs it, or a scrollbar can start a repaint loop. Painted surfaces don't scroll: a page inside them does.
- **Notes point rather than open.** A Finding filters the strongbox and lights the stat, Hero, or skills that answer it. Nothing replaces the report.
- **The lid** is a view transition between pictures of the desk, so canvases don't repaint mid-swing. Reduced motion, or no support, swaps instantly.
- **Marks state, never judge:** each tag marks, per Hero, only gains, only losses, both, or no change.
- **Pictures over words:** stats and Pick tags are glyphs with figures, items show their base name with stat glyphs, and the report is a tally of glyphs. The full words wait on chits and tooltips, and every glyph keeps them for screen readers.
- **The scene is the controls:** opening the valve on the supply pipe sends the Party: the wheel turns, oil runs through a sight-glass, a gauge climbs, and the in-line lantern takes; Hero tabs are class glyphs (funeral bread, trap, wick pole); the lid lifts itself, the next skill pip glows to take a point, a snuffer respecs, orders and skill order are dragged (or moved with the arrow keys), and items are equipped by clicking a Hero's bust or dragging onto one.
- **The report is a stone tablet:** grey ashlar in a riveted iron frame, a brass supply pipe climbing it and running through the Party's in-line lantern, its light and soot on the stone. The Oil's pipes are part of Town before anyone asks where they lead.
- **Fine art at whole screen pixels:** the lantern works and the class glyphs paint at twice the art density, always 2 screen pixels each, so they stay crisp at either art pixel.
- **Type roles:** the plate face on brass, the print face on paper, and figures always in the UI face. [The palette](../design.md#palette) has the table.

## Work, in order

Rapid prototyping: each piece lands as a commit straight on `main` and leaves the game runnable. Every UI change is seen working in the running app, and every pure helper gets a test.

| # | Work |
|---|---|
| 1 | **Painters into the game.** Move `Art`, the painters, and a `Painted` component into `src/ui/art/`, typed to the UI's lint and tsconfig. Pure pieces get tests: canvas sizing that never overhangs, bust framing, and the marks. The mockups import from there, so there's one copy. Nothing on screen changes yet |
| 2 | **The desk as the check-in.** When an Away Report is open, the desk replaces `CheckIn`: the ledger (figures, notes, standing orders, Send), the dossier, and the narrow strongbox, on the real store. Notes point, through a tested helper that turns a Finding into what to light and filter. Update [Check-ins](../design.md#check-ins), whose Findings no longer open a fix beside the list |
| 3 | **The lid.** The wide strongbox with tags and Hero marks, the spine of Hero cards, and the view transition. The `new` mark from today's Stash returns on tags |
| 4 | **The desk in Town and on a Run.** In Town, the desk replaces `TownMenu`, and the ledger takes its countdown, Send, and next Lamp. On a Run, the header's Planning and Stash tabs give way to one control that opens the desk over the Battle screen, with the Party still running. Update [Presentation](../design.md#presentation) |
| 5 | **The gaps.** A Wall section in the ledger: the next Lamp, Setbacks towards falling back, fallen back, and the end of the Tier. Weapons on portraits, lifted from the Battle scene's drawing. Renaming in the dossier. Refusals as stamps |
| 6 | **Retire the old screens.** Remove `PlanningTab`, `StashTab`, `PartyStash`, `CheckIn`, `TownMenu`, the old `PickRule`, the tab bar, and their CSS. Keep the mockups as references, or delete them if they've drifted |

## Questions for the human

Each comes up at the step named, and gets confirmed before that step builds it.

- **Step 4: the desk on a Run.** Should opening it pause the Party, as a check-in does, or let it keep running, as the tabs do today?
- **Step 4: the Live Log in Town.** It sits beside the Town menu today. Does it belong on the desk, or only on the Battle screen?
- **Step 5: the Wall's place.** A section of the ledger, or a notice of its own?
- **Later: Pick offers.** The mockup's Pick tickets have no home on the desk yet. They'd suit the Battle screen, as the Party takes them, or a report of the last Run's Picks.
