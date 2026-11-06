# Battle scene

How the animated Room in the Battle panel works, and how to change it. What it should look like is in [Presentation](design.md#presentation), and why it is a Canvas is in [ADR 0004](adr/0004-battle-scene-canvas.md).

The scene is presentation only. It adds no game rules, and it reads the sim only through `GameView` and `GameEvent`. The DOM unit cards stay beneath it as the readable record of health, Oil, and Effects.

## How a frame gets drawn

1. **Store:** after each step, `store.onPlayed` reports a batch of events and how many Ticks they cover. After catch-up, `ticks` is null.
2. **Stage:** `stage.play` starts animations from the batch. A batch over `MAX_ANIMATED_TICKS` (20), or a null one, skips them and shows the result.
3. **Frame loop:** on each animation frame, `BattleScene` calls `stage.advance`, `stage.sync`, and `stage.frame`. It runs outside React's renders, and `sync` picks up anything events didn't cover, such as a new Room.
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
| `stage.ts` | Unit positions, animation timelines, particles, floating numbers, Room changes |
| `draw.ts` | Paints a frame, including moving light, sprites, and the display size snap |
| `BattleScene.tsx` | The canvas, the frame loop, and the subscription to the store |

## Units of measure

- **Art pixels:** the 320 × 170 picture.
- **Scene units:** what `stage.ts` and `iso.ts` work in, 2 to each art pixel.
- **Display size:** `snappedDisplayWidth` picks the largest width where each art pixel covers a whole number of device pixels. A narrower panel gets a margin rather than uneven pixels. The panel asks for room for 2x.

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

1. Add its shapes to `FIGURES` in `art.ts`. Coordinates are scene units with the feet at 0, facing right.
2. Map the Unit to it in `FIGURES_BY_ID` or `FIGURES_BY_NAME`. Enemies are matched by name, so **renaming an enemy needs an update here**. An unknown enemy falls back to the Thrall figure.
3. Add a `WEAPONS` entry if it swings something, and a `LANTERNS` entry if it carries a lantern.

Hand-drawn art can replace a figure by producing the same `SpritePixel` list.

### Animate a new skill or action

Add a case to `playEvents` in `stage.ts`. A `skill` or `action` event arrives just before the hits it causes, so it can do one of two things:

- **Set a swing:** put a `Swing` in `styles`, and the next `attack` from that Unit uses it.
- **Start a move:** call `startMove` with its own timeline, as Lantern Ward does.

A skill with no case still works: melee Units use the default swing, and ranged Units a shot. The Guardian's `Grave Slam` is matched by action name, so renaming it needs an update here too.

## Checking a change

- **Tests:** `roomLook.test.ts` and `stage.test.ts` cover looks, ways, timing, jumps, and lantern dimming. Neither can say whether it looks right.
- **Running app:** `npm run dev`, then `?start=guardian` and `?level=` reach a Guardian Room or a stronger Party. These apply only to a new game, after "Start over".
- **Keeping a save:** localStorage is per origin, so `http://[::1]:5173/` starts a separate save from `http://localhost:5173/`.

## Not yet seen working

These have logic and some tests, but nobody has watched them in the running app:

- Bar the Way, Mend by Lamplight, and Lantern Ward
- The Guardian Room: its Lamp, sprite, Grave Slam, and Spore Breath
- A Hero falling and Rising
- Display scales other than 100%, and the Electron build

## Known limits

- Units walk over the arch frame when using a back-wall way, because the scene has no depth mask.
- The Party's Rows between Battles come from the last Battle, or a default before the first one.
- Enemies crumble and appear in place, rather than walking in through a way.
- Below about 1,030 px wide, the Floor map wraps above the Battle panel and pushes the scene down the page.
- The light sources are Provisional in [the lore bible](lore/bible.md#light-in-the-undercroft) until the human confirms them.
