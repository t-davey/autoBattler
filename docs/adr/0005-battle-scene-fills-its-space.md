# The Battle scene fills its space with more of the world

The Battle screen sets the scene in an iron frame: a rail above and a console below hold what used to lie over the scene's corners. Between them, the scene fills its space. It takes the whole-number scale that fits the 320 × 170 framing, rounding up a little past an exact fit, then shows as much of the world around the Room as covers the rest. Every art pixel stays a whole number of device pixels, and no window shape leaves a black margin.

The human chose this on 2026-11-16, after a throwaway mockup, kept on the local branch `prototype/battle-frame`, tried a frame that left iron side rails beside the scene.

## Considered options

- **A margin, as before:** wide windows showed bands of black, and overlays covered the scene's corners.
- **Iron side rails beside the scene:** tidy, but they kept the scene small and read as empty chrome.
- **Snapping the desktop window to sizes that fit:** Electron only, so the browser would keep its margins.
- **Cropping to fill:** cheap, but cuts the sky and the Room's front corner.
- **Uneven pixels to fill exactly:** rejected for the same reason as in [ADR 0004](0004-battle-scene-canvas.md).

## Consequences

Positions stay in the framing's art pixels, and a view is a window onto the world with its own size and top-left corner. Bakes and draw buffers are view-sized, and a resize only rebakes the Room, so animation carries on. Art has to reach past the framing: the lamp road runs its moor out to a horizon with a night sky, while the Undercroft shows more Dark until it gets its own art. With the rails, the scene is drawn a step smaller than it was over the whole window, 3x rather than 4x at 1280 × 720.
