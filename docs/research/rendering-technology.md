# Rendering technology

Research note, 2026-11-04. The human accepted its recommendation, recorded in [ADR 0003](../adr/0003-react-panels-dom-map.md). Versions and tooling status are as of this date.

**Labels:** cited claims link to their source. **Measured** means run locally for this note. **Judgement** is my reasoning. **Unverified** means I could not confirm it.

## Question and recommendation

Which stack should draw the dashboard, planning tabs, Away Report, and tile map?

**Recommendation: React 19 for panels, with the tile map as a plain DOM/CSS grid behind a small map component.** Add Canvas 2D or PixiJS inside that component only if the map outgrows the DOM.

**Main reason:** performance doesn't separate the options at this game's scale, but verification and toolchain fit do.

- Every option measured here hit the display's full refresh rate, and every framework's median panel update took about 1 ms or less.
- React's `.tsx` is type-checked by the repo's TypeScript 7 today, with no workaround. Svelte and Vue single-file components currently can't be checked that way.
- A DOM map stays readable through the accessibility tree and jsdom. Canvas pixels don't.

**Runner-up: Solid 1.9 with the same DOM map.** It passed the same toolchain checks and is the most direct fit for a sim that reports events. However, Solid 2.0 is at release candidate 21 with breaking changes to everyday APIs, so it means a near-term migration and more stale-API risk.

**What would change this:**

| If | Then |
|---|---|
| The main view should have animated sprites, particles, or a moving camera from the start | Use React with PixiJS on WebGL for the map from day one |
| Solid 2.0 ships and its docs settle | Solid becomes a stronger choice than React |
| TypeScript 7.1 and stable Svelte tooling ship, and the human prefers Svelte's style | Svelte is competitive, so re-run the checks below |
| A prototype with real data shows React re-rendering over budget | Move to Solid; the sim and store seam stays the same |

## Comparison

Stable versions and dates come from the npm registry on 2026-11-04. "Toolchain" means Vite 8.3.5 and TypeScript 7.0.2 in a minimal app (Measured). All measurements are defined under [Measurements](#measurements).

### Panels

| Option | Stable version (date) | Toolchain | Log update p50 / p99 | JS size, gzip | Agent fit (Judgement) | Sim fit |
|---|---|---|---|---|---|---|
| Plain DOM | Web platform | Passes | 0.3 / 0.6 ms | ~0 | Good to verify; hand-written updates get risky across the planning tabs | Direct, but you write every update |
| **React** | [19.3.1](https://www.npmjs.com/package/react) (Oct 14) | **Passes, `.tsx` checked** | 0.4 / 0.8 ms | 68 KB | Best: stable API, DOM output | `useSyncExternalStore` |
| Solid | [1.9.18](https://www.npmjs.com/package/solid-js) (Oct 29) | **Passes, `.tsx` checked** | 0.4 / 0.7 ms | 4 KB | Good output, high stale-API risk from 2.0 | Signals and stores, most direct |
| Svelte | [5.57.3](https://www.npmjs.com/package/svelte) (Oct 26) | Builds, but **`svelte-check` needs TS 6 alongside** | 1.1 / 1.9 ms | 10 KB | Good output; `npm run check` needs rework | `$state` module |
| Vue | [3.5.44](https://www.npmjs.com/package/vue) (Oct 13) | Builds, but **`vue-tsc` crashes on TS 7** | 0.4 / 0.8 ms | 24 KB | Good output; template checking needs TS 6 | `shallowRef` |

### Tile map

All ran 880 tiles at a steady ~144 fps. Pixel results compare Windows display scale at 100% and 125%.

| Option | Stable version (date) | Crisp at 100% | At 125%, as tested | Readable by agents | Runs under jsdom | Fit |
|---|---|---|---|---|---|---|
| **DOM/CSS grid** | Web platform | Yes | No blending, uneven pixel widths | **Yes** | **Yes** (no layout) | **Start here** |
| Canvas 2D | Web platform | Yes | **Blurred** until DPR is handled | No | [No, without a backend](https://github.com/jsdom/jsdom) | First step up, no dependency |
| PixiJS (WebGL) | [8.22.0](https://www.npmjs.com/package/pixi.js) (Oct 1) | Yes | **Blurred** until DPR is handled | No | **No** (Measured) | Step up if effects or many sprites arrive |
| Phaser | [4.2.1](https://www.npmjs.com/package/phaser) (Jul 9) | Yes | No blending, uneven pixel widths | No | Not tested | Poor: a game engine around a game that already has its rules |

## Findings

### Long sessions and hidden windows

This applies whichever option is chosen, and it matters more than the renderer.

- **Measured:** on this Windows 11 machine with Electron 45.2.2 defaults, a window **fully covered by another window** reported `hidden`, and `requestAnimationFrame` stopped. A 100 ms `setInterval` slowed to once a second. Minimizing and `win.hide()` did the same.
- **This conflicts with the docs:** Electron says that off macOS the state is [hidden only when minimized](https://www.electronjs.org/docs/latest/api/browser-window#page-visibility). I saw otherwise on one machine, so re-check it on a friend's PC.
- **Measured:** after more than 5 minutes hidden, the timer fell to about once a minute, in line with Chrome's [intensive throttling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88). In this run the window was hidden from the start: it was covered, then minimized.
- **Measured:** a timer in a Web Worker kept its full 10 per second throughout. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout) and the Chrome post don't promise this, so treat it as observed behaviour only.
- **Measured:** with [`backgroundThrottling: false`](https://www.electronjs.org/docs/latest/api/structures/web-preferences), the page stayed `visible` and `requestAnimationFrame` kept running at ~142 per second while minimized. Electron recommends [pausing expensive work when hidden](https://www.electronjs.org/docs/latest/api/browser-window#page-visibility) instead.
- **Rendering libraries don't own game time.** [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) says `requestAnimationFrame` pauses in most browsers' background tabs. [Pixi's ticker](https://github.com/pixijs/pixijs/blob/dev/src/ticker/Ticker.ts) clamps `deltaMS` to 100 ms by default, and [Phaser's docs](https://docs.phaser.io/api-documentation/event/core-events) say the pause can't be prevented.

**Judgement:** drive the sim from elapsed wall-clock time, read in `src/ui` and passed in as input. ADR 0001 already takes elapsed time this way. A throttled timer then just delivers larger steps, in a browser tab as well as in Electron, and the render loop never affects game speed. [docs/design.md](../design.md#time-and-pacing) has since adopted catch-up for hidden windows.

### Growing log and large lists

- **Measured:** an uncapped DOM list gets slower as it grows. Forced layout after one append took:

  | Rows | Layout p50 |
  |---|---|
  | 1,000 | 0.1 ms |
  | 10,000 | 1.8 ms |
  | 50,000 | 10.9 ms |
  | 100,000 | 26.6 ms |

  The renderer's working set was about 530 MB at 100,000 rows. At one line a second, 12 hours would be 43,200 lines.
- **Measured:** capped at 1,000 rows, the JS heap grew by under 0.15 MB across 3,000 updates in every framework. That is not a multi-hour soak.
- **Measured:** use `<ul>` or `<div>` for the log, not `<ol>`. Removing the first row of a 1,000-row `<ol>` took 4.3 ms p50, against 0.3 ms for `<ul>`, probably from renumbering (Judgement).
- For large lists, [TanStack Virtual](https://tanstack.com/virtual/latest/docs/introduction) supports all four frameworks and plain JS. [`content-visibility: auto`](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility) is a lighter option that keeps off-screen rows in the accessibility tree. I tested neither.

**Judgement:** keep a bounded row window in the DOM. Keep older entries in a separate store with its own retention rule. Offline catch-up should produce a summary for the Away Report, and must not push 12 hours of events through the panels.

### Pixel art

- **CSS:** [`image-rendering: pixelated`](https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering) is widely available and applies to images and backgrounds, so a sprite atlas works through `background-position`. Animation can use CSS `steps()` or swapped positions (Judgement; not tested).
- **Canvas 2D:** [`imageSmoothingEnabled = false`](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas) controls scaling when drawing. Atlases and animation are hand-written.
- **PixiJS:** [per-texture `scaleMode`](https://pixijs.com/8.x/guides/components/textures), [spritesheet loading](https://pixijs.com/8.x/guides/components/assets), and [`AnimatedSprite`](https://pixijs.download/dev/docs/scene.AnimatedSprite.html) are built in. Setting `TextureSource.defaultOptions.scaleMode = 'nearest'` worked here (Measured).
- **Phaser:** [`pixelArt` and `smoothPixelArt`](https://github.com/phaserjs/phaser/blob/master/docs/Phaser%204%20Pixel%20Art%20Guide/Phaser%204%20Pixel%20Art%20Guide.md) are the strongest built-in support, along with tilemaps.
- **Fractional display scale is the real risk (Measured):**
  - At 125%, the 8-colour test atlas stayed 8 colours in the DOM grid and Phaser, but art pixels became an uneven mix of 2 and 3 device pixels.
  - Canvas 2D and Pixi, with their buffers not sized for the display, produced about 625 colours, which means visible blur.
  - The standard fix is to [size the buffer by `devicePixelRatio`](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio). I did not test that fix. Uneven pixels need a scale where scale × DPR is a whole number (Judgement).

### Toolchain compatibility

- **TypeScript 7 is the deciding constraint.** The repo uses TypeScript 7. Its [announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) says 7.0 ships no API, and that Vue and Svelte projects must stay on 6.0 for now.
- **Svelte (Measured):**
  - `npm install svelte-check@4.7.8` fails on its [peer range](https://www.npmjs.com/package/svelte-check), which stops at TypeScript 6.
  - A deliberate type error in a `.svelte` file left `tsc` and `vite build` green, so `npm run check` would miss it without `svelte-check`.
  - The [documented dual install](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-check) caught the error, but it makes `typescript` resolve to 6.
  - The [tracking issue](https://github.com/sveltejs/language-tools/issues/3063) is open with no date.
- **Vue (Measured):** `vue-tsc` 3.3.14 crashed on TypeScript 7.0.2 with `ERR_PACKAGE_PATH_NOT_EXPORTED`, and it caught the type error on TypeScript 6.0.3. A [draft v4 pull request](https://github.com/vuejs/language-tools/pull/6170) targets 7.1.
- **TypeScript 7.1 may clear both.** The [beta post](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/) adds content mappers and expects an RC about a month after Oct 20. **Unverified:** the [iteration plan's](https://github.com/microsoft/TypeScript/issues/63703) Nov 24 stable date looks stale, and when Svelte and Vue tooling will catch up.
- **React (Measured):** a `.tsx` app using the repo's strict compiler options passed, and a bad prop failed. `vite build` passed, and the dev server served the transformed entry. A Vitest 5 test with jsdom and Testing Library drove `useSyncExternalStore` through to the DOM. I did not exercise hot reload. [`@vitejs/plugin-react` 6.2.1](https://www.npmjs.com/package/@vitejs/plugin-react) declares `vite ^8.0.0`, and its [Vite 8 notes](https://vite.dev/blog/announcing-vite8) cover the move to Oxc.
- **Solid (Measured):** `tsc` passed and a bad prop failed. `vite build` passed, and a Vitest 5 test with [`@solidjs/testing-library`](https://docs.solidjs.com/guides/testing) passed. [`vite-plugin-solid`](https://www.npmjs.com/package/vite-plugin-solid) declares Vite 8.
- **PixiJS (Measured):** `tsc` passed even with `skipLibCheck: false`, in line with [8.21.0's TypeScript 7 note](https://github.com/pixijs/pixijs/releases). `vite build` passed, with renderers split into separate chunks (about 163 KB gzip in total).
- **Phaser (Measured):** `tsc` passed with the repo's `skipLibCheck: true`, but its own `.d.ts` files fail with `false`. `vite build` passed as one 354 KB gzip chunk.

### Fit with Electron

- All options ran in a sandboxed Electron 45.2.2 window from `file://`, once the Pixi fix below was applied (Measured). Electron 45.0 is [built on Chromium 156](https://www.electronjs.org/blog/electron-45-0).
- **PixiJS failed under a strict CSP (Measured):** `app.init` threw "Current environment does not allow unsafe-eval". Importing `pixi.js/unsafe-eval` fixed it. Phaser needed nothing. The repo has no CSP yet, but [Electron's guide](https://www.electronjs.org/docs/latest/tutorial/security) recommends one.
- Pixi's [WebGPU renderer](https://pixijs.com/8.x/guides/components/renderers) ran here (Measured), but its docs label it experimental and recommend WebGL for production. The [Canvas renderer](https://github.com/pixijs/pixijs/releases) arrived as experimental in v8.16.0. Use WebGL.

### Maintenance

- **React:** [19.3.0 shipped Sep 9](https://react.dev/versions), with 19.3.1 following.
- **Svelte:** [releases about every 3 weeks lately](https://github.com/sveltejs/svelte/releases).
- **Vue:** 3.5 is stable, and [3.6 is at RC.14](https://github.com/vuejs/core/releases). It [adds Vapor Mode and a reactivity refactor](https://raw.githubusercontent.com/vuejs/core/minor/CHANGELOG.md).
- **Solid:** 1.9 still gets patches, but [all current work is on 2.0 RCs](https://github.com/solidjs/solid/releases). The [migration guide](https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/MIGRATION.md) removes `batch` and `Index`, splits `createEffect`, and replaces `onMount`. Reads after a write also stop updating until a flush.
- **PixiJS:** [ten releases since February](https://github.com/pixijs/pixijs/releases), though minor versions often carry "behaviour change" notes, so pin it.
- **Phaser:** [4.0 in April, 4.2.1 in July](https://github.com/phaserjs/phaser/releases). [Canvas is deprecated](https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games).
- **Helper packages:** [`@pixi/react`](https://www.npmjs.com/package/@pixi/react) was last published Dec 2025 and [`@pixi/tilemap`](https://www.npmjs.com/package/@pixi/tilemap) Jul 2025. Neither is needed at this scale (Judgement).

### Other contenders

- **Phaser:** [`DOMElement`s always sit above the canvas](https://docs.phaser.io/phaser/concepts/gameobjects/dom-element) and can't interleave with sprites. It brings its own loop, scenes, and game objects, while `src/sim` owns the rules and most of this game is panels. Most of its value would go unused (Judgement).
- **Excalibur** ([0.32.0, Dec 2025](https://www.npmjs.com/package/excalibur)) and **KAPLAY** ([3001.0.19, Jun 2025](https://www.npmjs.com/package/kaplay)) have the same mismatch, and their latest releases are older. I checked the registry only.
- **Preact** ([11.1.1](https://www.npmjs.com/package/preact)) with [signals](https://www.npmjs.com/package/@preact/signals) is a possible lighter step from React. Not tested. Bundle size hardly matters on desktop, so I wouldn't start there (Judgement).

### Agent development (Judgement)

- **DOM output can be checked as text. Canvas can't.**
  - **Measured:** the Chromium accessibility tree of a plain DOM log held 39 nodes and included the log text. A Pixi `Text` with the same string produced 4 nodes and no text. [MDN agrees](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas) that canvas content isn't exposed to accessibility tools.
  - Pixi's [accessibility overlay](https://pixijs.com/8.x/guides/components/accessibility) is opt-in and covers only objects you register.
- **Tests differ by surface.**
  - jsdom runs DOM components, though it [does no layout](https://github.com/jsdom/jsdom).
  - Pixi's `init` threw under jsdom (Measured), so its tests would need [Vitest browser mode](https://vitest.dev/guide/browser/) or screenshots. I did not run browser mode.
  - [Playwright ARIA snapshots](https://playwright.dev/docs/aria-snapshots) can assert page structure, and its [Electron support is experimental](https://playwright.dev/docs/api/class-electron).
- **Screenshots still work everywhere.** `capturePage` worked in all options, and counting colours caught the 125% blur (Measured). That makes a cheap crispness check.
- **Stale knowledge varies.**
  - React's core API has changed least across versions, so an agent's memory is most likely to be right.
  - Svelte 4 and 5 differ sharply, and Solid is mid-transition, so agents should read current docs.
  - Vendor material helps: [Svelte llms.txt](https://svelte.dev/docs/llms), [Pixi skills](https://github.com/pixijs/pixijs-skills), and [Phaser skills](https://github.com/phaserjs/phaser). I confirmed these exist, not their quality.
- **React's agent-specific risks** are unnecessary effects and whole-tree re-renders. Store selectors and memoized rows address the second; review addresses the first.

### Sim events to renderer

The tracer `simulateBattle` runs to completion, and [ADR 0001](../adr/0001-deterministic-sim-core.md) says it needs converting. A stepping API must exist before any of this applies.

Suggested flow (Judgement):

1. A driver in `src/ui` reads the clock and passes elapsed time and player actions into the sim.
2. It folds the reported events into one UI store: current snapshot plus bounded feeds for the Live Log and loot.
3. Components subscribe to the parts they show, at most once per render frame. A render frame is not a Tick.

The store has no framework dependency, so changing framework later costs only the components. Each framework connects differently:

- **React:** [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore), which requires immutable, cached snapshots.
- **Solid:** [stores with `reconcile`](https://docs.solidjs.com/concepts/stores), which update only what changed.
- **Svelte:** a [`$state` module](https://svelte.dev/docs/svelte/stores), the docs' recommended approach to shared state.
- **Vue:** [`shallowRef`](https://vuejs.org/guide/extras/reactivity-in-depth.html), replacing the value on change.
- **Pixi or Canvas:** read the same store in a draw callback.

## Measurements

The setup was one Windows 11 machine with a 144 Hz display and two monitors. I used production Vite builds in Electron 45.2.2, sandboxed, from `file://`. The harness was throwaway code in the scratchpad and is not in the repo.

- **Log:** one row added, the oldest removed at 1,000 rows, three HP labels updated, forced layout, 3,000 updates, two runs in opposite orders. The two runs matched. Times exclude paint and have 0.1 ms resolution. Updates are idiomatic for each framework but not tuned; Svelte's result used a deep `$state` array, and `$state.raw` might differ.
- **Map:** 880 tiles at 32 px from a 16 px atlas, 10 tile changes per render frame, 8 seconds. Canvas 2D redrew every tile each frame. GPU time wasn't measured, and this machine is not a low-end test. Pixi WebGPU ran at 100% only.
- **JS size:** the minimal-app builds. The Pixi and Phaser figures are from the map bench and include a little harness code. This is not a performance ranking.
- **Interrupted runs:** several runs stalled at first because the test window was behind others, which is how I found the covered-window behaviour. Map results come from runs with the window on top or uncovered.

These are small checks on one machine, not settled benchmarks. No third-party benchmark claims are used.

## Risks and open questions

### For the human

Hidden-window behaviour, log retention, Stash size, animation, and pixel-art scale have since been decided. The first three are in [docs/design.md](../design.md), and the last two in [ADR 0004](../adr/0004-battle-scene-canvas.md): the Floor map stays in the DOM, a separate Canvas scene carries the animation, and art pixels snap to whole device pixels.

### What a small prototype should check

Build the dashboard against a stepping sim stub, plus one planning tab such as auto-salvage rules:

1. **Soak:** run several hours live and watch heap, working set, and DOM node count. Nothing here ran longer than minutes.
2. **Catch-up:** does simulating 12 hours block the window noticeably? If so, a Worker may be needed. Cost is unknown because the sim doesn't step yet.
3. **Return from hidden:** cover the window for over 5 minutes, then uncover it. Check that the Party catches up and the panels don't flood.
4. **Friends' PCs:** check covered-window visibility, and crispness at 100%, 125%, and 150%.
5. **Stash:** render the expected worst-case size, with sort and filter, and decide whether virtualization is needed.
6. **Agent loop:** have an agent change a panel and the map, then verify through tests, `npm run dev`, and `npm run smoke:electron`.

### Known risks

- **React re-renders:** frequent store updates can re-render too much without selectors and memoized rows.
- **Map migration:** moving later from DOM to Canvas loses text-based checks for the map. Keep the map's data as a plain, tested structure so those tests survive.
- **Scroll position:** a capped log with rows removed from the top needs care with [scroll anchoring](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor). Not tested.

### Findings that touch existing docs

- **[ADR 0001](../adr/0001-deterministic-sim-core.md):** supported. The throttling results strengthen the case for elapsed time as an input.
- **[ADR 0002](../adr/0002-browser-first-electron-shell.md):** consistent. React runs on web APIs only. `backgroundThrottling` is desktop-only, which is another reason to prefer catching up, since that behaves the same in a browser tab.
- **[CONTEXT.md](../../CONTEXT.md):** "Battle Log" covers one Battle, so the dashboard's log now has its own term, Live Log. The loot feed may need a term once it settles.
- **Repo setup:** `electron/main.ts` uses `loadFile` and `index.html` has no CSP, while [Electron's guide](https://www.electronjs.org/docs/latest/tutorial/security) advises a CSP and a custom protocol over `file://`. This isn't urgent for a friends-only game with local content, but it should be decided before Pixi, because of the `unsafe-eval` import.

### Unverified

- Electron's Windows occlusion behaviour beyond this one machine, and why it differs from the docs.
- Dates on some GitHub release pages show no year. I inferred 2026 from the registry, or from context where the registry doesn't list the release.
- Revised TypeScript 7.1 RC and stable dates, and Svelte and Vue tooling timelines.
- Multi-hour memory behaviour for every option.
- Vitest browser mode, TanStack Virtual, `content-visibility`, and Preact were read about but not run.
