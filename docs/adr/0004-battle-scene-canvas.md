# The Battle scene is a Canvas 2D view at 320 x 170

The Battle panel draws an animated isometric Room in `src/ui/battleScene`, on a plain Canvas 2D at 320 x 170 art pixels. The DOM unit cards stay beneath it, so health, Oil, and Effects remain readable as text, by the accessibility tree, and by tests. Everything in it is presentation: the sim knows Rows rather than positions, and it gains no rules for the scene.

Each art pixel covers a whole number of device pixels. The canvas takes the largest such size that fits its panel, leaving a margin rather than drawing uneven pixels, which settles the fractional display question in the [research note](../research/rendering-technology.md).

## Considered options

- **PixiJS:** per-pixel lighting doesn't need it, and it would add a dependency and the `unsafe-eval` decision. Revisit if the scene needs many more particles than this.
- **Moving the DOM map to Canvas:** the Floor map works as text and has no need for this.
- **Accepting uneven pixels at 125% and 150%:** a slightly larger picture, with visibly lumpy sprites at this resolution.

## Consequences

The store tells the scene what each step played, in batches. A batch of more than 20 Ticks, or catch-up, skips animation and shows the result, so the render loop still never affects game speed. Most of the scene is plain functions over typed arrays, so its rules run under Vitest without a canvas, while judging how it looks still takes the running app. [The Battle scene guide](../battle-scene.md) covers working on it.
