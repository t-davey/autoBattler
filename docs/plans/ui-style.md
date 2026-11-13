# UI style: plan

The general style for the UI overhaul, grounded in Town and [the lore](../lore/bible.md). [The palette](../design.md#palette) holds the colours, and this plan says what the UI's elements look like and the order of work. **Spoilers:** it leans on the Rendering.

**Status: direction decided, not built.** The human chose on 2026-11-11:

- **Civic lamp-works.** The chrome borrows from Town as the Town Council runs it, rather than from the Penitents' Order or the pipeworks.
- **Pixel chrome.** Frames, buttons, icons, and bars are pixel art, so the window reads as one piece with the 320 × 170 Battle scene. Text stays smooth.
- **Town fixed, Run tinted.** Town's screens keep one look. During a Run the accents shift by Act, on the same shapes.

## The idea

Town is orderly, lamp-lit, and run on paperwork. The Council posts notices, stamps forms, and keeps ledgers of what arrives each evening, and the Lamplighters' kit is brass and glass. The UI is that paperwork and that kit.

It gives every screen two readings, as [the writing rules](../lore/README.md#writing-rules) ask. On a first visit it's a tidy civic town. Once the player suspects the truth, the same forms are a supply line, counted and stamped and never asked about.

## Rules

- **The Council's own words.** Forms count and stamp but never say where anything comes from. Oil arrives as "the evening supply", in measures and tins.
- **No pipes or valves in the chrome.** The pipes from the Ember Works stay unseen until Act 3, as [Oil in Town](../lore/bible.md#oil-in-town) requires. They can appear in Act 3's tint, not before.
- **Flame stays scarce.** Only what is lit, selected, new, or rare, as the palette says. A screen with flame everywhere has none.
- **Pixel-true.** Chrome scales by whole steps with `--ui-scale`, with no rounded corners, blur, or smooth gradients. Shadows are hard 1-pixel offsets and shading is banded, like the scene.
- **Grim, not ornate.** Tracery, stained glass, and reliquary frames belong to the Order. Keep them for a later, story-only use, if ever.

## Elements

| Element | Civic object | Notes |
|---|---|---|
| Panel | An enamelled iron plate, riveted, with brass corner brackets | Today's `plate.svg`. Variants below |
| Panel title | A struck brass nameplate across the plate's top | Cinzel capitals. Type roles are in [the palette](../design.md#palette) |
| Notice | A Council notice pinned to a plate | Findings, Act introductions, the end of a Tier |
| Chit | A small paper slip | Tooltips, item details, Pick offers |
| Ledger | A ruled page with a red margin | The Away Report, today. Lists of numbers use dot leaders |
| Button | A brass push-plate | Pressed shows a 1-pixel inset. Disabled is unpolished, in soot |
| Main button | A lit wick | Today's "Send the Party back". One per screen |
| Tabs | Ledger index tabs, cut from the page's edge | The selected tab joins the page |
| Bars | Lamp glass in an iron or brass case, banded | Today's health bars and Oil gauge |
| Icons | Die-stamps: one colour, on a 16-pixel grid | Today's pixel icons, made consistent |
| Refusal | A rust-red rubber stamp | "Refused", with the reason beneath |
| New / rare | A flame-coloured mark | As the palette says |
| Town's places | Hanging shop signs on brackets | Merchant, gamble vendor, the Lamplighters' hall |

## Tint by Act

A Run swaps a few accent tokens: an Act's accent, glow, and ground. Shapes, text, flame, and the stat colours stay the same. Town never tints.

| Act | Tint | From | Status |
|---|---|---|---|
| 1. The wilderness | Mist grey and lantern green, cold | The Barrier Lamps in the dark | Provisional: Act 1's look is [open](../lore/bible.md#open-questions) |
| 2. The Undercroft | Foxfire verdigris and mould | [Light in the Undercroft](../lore/bible.md#light-in-the-undercroft) | Provisional |
| 3. The Ember Works | Slag orange and soot. Pipes may appear | The refinery | Provisional: Act 3's Oil source is open |

## Work, in order

Rapid prototyping, as in [Roguelite Runs](roguelite-runs.md): each piece lands on `main` and leaves the game runnable, and is seen in the running app.

| # | Work |
|---|---|
| 1 | **Tokens.** Act tint tokens on `:root`, set by the Run's Act, and a pixel unit tied to `--ui-scale`. Add the deep shades to [the palette](../design.md#palette) table: **done**. The Battle screen carries `data-act`, which swaps `--act-accent`, `--act-glow`, and `--act-ground`. Nothing reads them until step 5. `--px` rounds the UI scale to whole device pixels, so a chrome pixel is 2 device pixels at 1080p rather than a blurry 1.5 |
| 2 | **Chrome kit.** Plate, notice, chit, and ledger frames as 9-slice pixel SVGs, with brass push-plate buttons and index tabs. The shelved [Council desk mockup](council-desk.md) tried painted pixel art instead, and its painters remain in `mockups/` |
| 3 | **Icons.** One die-stamp set on a 16-pixel grid, replacing mismatched icons |
| 4 | **Town.** The menu as hanging signs, one per place |
| 5 | **Run.** The Battle screen's overlays take the Act tint |
| 6 | **Picks and Findings.** Pick offers as chits, and Findings as Council notices |

## The Council desk

**Shelved by the human on 2026-11-13.** The game keeps the Away Report, Planning, and Stash as three tabs. [The plan](council-desk.md) and [the mockup](../../mockups/council-desk.html) stay as a reference. The mockup had put all three on one screen, the Council desk:

- **The ledger,** on the left: the Away Report's figures with dot leaders, its Findings as paper notes, the Pick rule as standing orders, and Send.
- **The dossier,** in the middle: one Hero at a time behind index tabs, with their Battle sprite as a portrait, gauges, gear, stats, compact skills with detail on a chit, and skill order.
- **The strongbox,** on the right: the Stash at the dossier's Slot, with the picked item's changes for every Hero and an Equip beside each.
- **A note points rather than opens.** A Finding filters the strongbox and lights the stat, Hero, or skills that answer it, so nothing replaces the report.

## Open questions

- **Act 1's look.** Its tint waits on the wilderness's name and enemies.
- **The central Lamp.** If Town's central Lamp gets a role, the header may show it as Town's state.
- **Picks' name.** The chits' wording waits on what Picks are called.
- **The ledger Fragment.** How the player reads one is [open](../lore/bible.md#open-questions), and it may want its own frame.
