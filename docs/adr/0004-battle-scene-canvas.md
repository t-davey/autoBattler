# The Battle scene is a Canvas 2D view at 320 x 170

The Battle screen draws an animated isometric Room in `src/ui/battleScene`, on a plain Canvas 2D at 320 x 170 art pixels. DOM elements lie over the corners of the scene, so the Party's health, Oil, and Effects remain readable as text, by the accessibility tree, and by tests. Each enemy's health and Effects show on its sprite, with exact numbers only in a visually hidden list. Everything in it is presentation: the sim knows Rows rather than positions, and it gains no rules for the scene.

Each art pixel covers a whole number of device pixels. The canvas takes the largest such size that fits the window under the header, leaving a margin rather than drawing uneven pixels, which settles the fractional display question in the [research note](../research/rendering-technology.md).

The overlays and header are sized for a 1280 x 720 window, where the scene fills 1280 x 680, then grow through CSS `zoom` in step with the scene. CSS `zoom` re-lays out text at the larger size, so it stays sharp and the corners keep the same proportions on any screen.

## Considered options

- **PixiJS:** per-pixel lighting doesn't need it, and it would add a dependency and the `unsafe-eval` decision. Revisit if the scene needs many more particles than this.
- **Fixed-size overlays:** these looked small on a 1440p screen, since the scene grew around them.
- **Moving the DOM map to Canvas:** the Floor map works as text and has no need for this.
- **Accepting uneven pixels at 125% and 150%:** a slightly larger picture, with visibly lumpy sprites at this resolution.

## Consequences

The store tells the scene what each step played, in batches. A batch of more than 20 Ticks, or catch-up, skips animation and shows the result, so the render loop still never affects game speed. Most of the scene is plain functions over typed arrays, so its rules run under Vitest without a canvas, while judging how it looks still takes the running app. [The Battle scene guide](../battle-scene.md) covers working on it.
