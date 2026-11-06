# The UI uses React panels and a DOM tile map

`src/ui` uses React 19 for panels and a plain DOM/CSS grid for the tile map, behind a small map component. Performance didn't separate the options at this game's scale, so we chose on verification and toolchain fit: React's `.tsx` is type-checked by TypeScript 7 today, and DOM output can be read and tested as text, which suits agent development. The evidence is in [the research note](../research/rendering-technology.md).

## Considered options

- **Solid:** the closest fit for a sim that reports events, but Solid 2.0 is close, with breaking changes to everyday APIs. Revisit once it ships and its docs settle.
- **Svelte and Vue:** their component type-checking currently needs TypeScript 6 installed. Revisit once their tooling supports TypeScript 7.
- **Canvas 2D or PixiJS for the map:** these give up text-based checks. Move the map to one of them, inside its component, if it needs effects, many sprites, or a moving camera. The Floor map stays in the DOM. The Battle scene, which needed those things, is a separate Canvas: see [ADR 0004](0004-battle-scene-canvas.md).
- **Phaser:** it brings its own loop, scenes, and game objects, while `src/sim` owns the rules and most of the game is panels.

## Consequences

Sim events reach components through a store that stays free of React, so changing framework later costs only the components. The render loop never sets game speed, because hidden windows stop drawing and throttle timers. The Live Log has a cap of 1,000 rows. The tile map arrives with Floors.
