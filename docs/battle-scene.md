# Battle scene

How the animated Room on the Battle screen works, and how to change it. What it should look like is in [Presentation](design.md#presentation), and why it is a Canvas is in [ADR 0004](adr/0004-battle-scene-canvas.md).

The scene is presentation only. It adds no game rules, and it reads the sim only through `GameView` and `GameEvent`. `BattleScreen.tsx` lays the DOM Floor map, Pack bar, Party status, and Live Log over its corners. Those are the readable record of the Party's health, Oil, and Effects. Enemies show theirs on their sprites, with the details in a visually hidden list.

## How a frame gets drawn

1. **Store:** after each step, `store.onPlayed` reports a batch of events and how many Ticks they cover. After catch-up, `ticks` is null.
2. **Scene:** `scene.play` starts animations from the batch. A batch over `MAX_ANIMATED_TICKS` (20), or a null one, skips them and shows the result.
3. **Frame loop:** on each animation frame, `BattleScene` calls `scene.advance`, `scene.sync`, and `scene.frame`. It runs outside React's renders, and `sync` picks up anything events didn't cover, such as a new Room.
4. **Drawing:** `drawScene` paints the frame into an RGBA buffer, which the component copies to the canvas.

The driver owns game time, so the scene never sets game speed. When the window is hidden, the frame loop stops, and the driver makes up the gap when the window returns.

## Modules

All are in `src/ui/battleScene`. Only `BattleScene.tsx` touches React or the DOM, so the rest run under Vitest.

| File | Holds |
|---|---|
| `iso.ts` | Geometry: art size, tile projection, wall points, formation points, way points |
| `roomLook.ts` | A Room's ways through and light sources, decided from its Floor layout |
| `roomBake.ts` | Turns a look into per-pixel surfaces and fixed light, including arches and landings |
| `art.ts` | Colour ramps, figures built from shapes, weapons, lantern positions |
| `scene.ts` | Unit positions, animation timelines, particles, floating numbers, Room changes |
| `draw.ts` | Paints a frame, including moving light, sprites, and the display size snap |
| `BattleScene.tsx` | The canvas, the frame loop, and the subscription to the store |

## Units of measure

- **Art pixels:** the 320 × 170 picture.
- **Scene units:** what `scene.ts` and `iso.ts` work in, 2 to each art pixel.
- **Display size:** `snappedDisplayWidth` picks the largest width where each art pixel covers a whole number of device pixels. A window of another shape gets a margin rather than uneven pixels.
- **UI scale:** `uiScale` finds the largest whole-pixel scene that fits a 16:9 share of the window, compares it with 1280 wide, and sets `--ui-scale`, which zooms the header and overlays with it. It never goes below 1, so a window under 1280 x 720 shrinks the scene but not the text. Size overlays for the base window.

## Rooms

- **Ways through:** a grid step on the Floor map decides the edge, so left on the map is the back-left wall and up is the back-right wall. Right and down are the front edges.
- **Light sources:** the look rolls 1 of 7 mixes of Spigot burners, Tallow candles, and Foxfire. A lone source keeps at least 4 spots, and a mix keeps at least 2 of each.
- **Stability:** a look depends only on the Floor number, layout, and Room index. It uses its own hash and draws nothing from the sim's RNG.
- **Lamps:** one stands only in a Guardian Room, lit once `view.wall.lampLit` is true.

## Light

- **Fixed light** is baked per Room in `bakeRoom`: warm from flames, cold from Foxfire.
- **Moving light** is worked out per frame in `drawScene`: lanterns, hit flashes, and shots.
- **Lanterns** set their radius and strength from `oil / maxOil`. Zero Oil dims a lantern without putting it out.
- **Minimums:** `AMBIENT` keeps stone readable, and `UNIT_MINIMUM_LIGHT` keeps every Unit readable. Keep both if you tune the look, since the scene was too dark without them.

## Changing it

### Add or replace a figure

1. Add its shapes to `FIGURES` in `art.ts`. Coordinates are art pixels with the feet at 0, facing right, so a figure sits on the Room's grid. Detail goes no finer than one art pixel, and `bake` dithers its shading with the Room's pattern.
2. Map the Unit to it in `FIGURES_BY_ID` or `FIGURES_BY_NAME`. Enemies are matched by name, so **renaming an enemy needs an update here**. An unknown enemy falls back to the Thrall figure.
3. Add a `WEAPONS` entry if it swings something, and a `LANTERNS` entry if it carries a lantern, both in art pixels.

Hand-drawn art can replace a figure by producing the same `SpritePixel` list.

### Animate a new skill or action

Add a case to `playEvents` in `scene.ts`. A `skill` or `action` event arrives just before the hits it causes, so it can do one of two things:

- **Set a swing:** put a `Swing` in `styles`, and the next `attack` from that Unit uses it.
- **Start a move:** call `startMove` with its own timeline, as Lantern Ward does.

A skill with no case still works: melee Units use the default swing, and ranged Units a shot. The Guardian's `Grave Slam` is matched by action name, so renaming it needs an update here too.

## Checking a change

- **Tests:** `roomLook.test.ts` and `scene.test.ts` cover looks, ways, timing, jumps, and lantern dimming. Neither can say whether it looks right.
- **Running app:** `npm run dev`, then `?start=guardian` and `?level=` reach a Guardian Room or a stronger Party. These apply only to a new game, after "Start over".
- **Keeping a save:** localStorage is per origin, so `http://[::1]:5173/` starts a separate save from `http://localhost:5173/`.

## Not yet seen working

Most of the scene has been watched in the running app, including Lantern Ward, Bleed, Poison, deaths, Heroes falling, and an unlit Guardian Room. These haven't:

- **Bar the Way and Mend by Lamplight:** both fired with no errors, but no screenshot caught them mid-animation, so how they look is unjudged.
- **A lit Lamp, and a Hero Rising.**
- **Display scales other than 100%, and the Electron build.** Snapping is tested only as a calculation.

## Known limits

- Units walk over the arch frame when using a back-wall way, because the scene has no depth mask.
- The Party's Rows between Battles come from the last Battle, or a default before the first one.
- Enemies crumble and appear in place, rather than walking in through a way.
- Poison ticks that land together overlap, so two floating 3s can read as 33.
- A very large Floor layout gets smaller map tiles, so the map stays clear of the wall.
- Only the header scales on the Planning tab, in Town, and in a check-in, so their content looks small beside it on a large screen.
- Below 1280 × 720, the overlays can cover the Room or each other.
- The light sources are Provisional in [the lore bible](lore/bible.md#light-in-the-undercroft) until the human confirms them.
