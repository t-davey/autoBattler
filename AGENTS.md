# autoBattler

An idle dungeon crawler, released as a Windows desktop app through Electron and developed in the browser.

## Boundaries

Dependencies point one way: `electron/` is standalone, `src/ui` imports `src/sim`, and `src/sim` imports only itself.

- `src/sim`: the game's rules. Pure and deterministic: same setup, same result. Callers import from `src/sim/index.ts`. New game rules go here, whatever screen they surface on. Why: [ADR 0001](docs/adr/0001-deterministic-sim-core.md).
- `src/ui`: draws what the sim reports and sends player choices back to it. Web APIs only, so it runs unchanged in a browser tab. Why: [ADR 0002](docs/adr/0002-browser-first-electron-shell.md).
- `electron/`: window lifecycle and desktop-only integration.

## Language

Read [CONTEXT.md](CONTEXT.md) before naming a game concept in code, docs, or conversation. Use its terms. When a new concept settles, add it there. Record decisions that meet the bar in `docs/adr/`.

## Game design

The human owns game design. Read [docs/design.md](docs/design.md) before changing game rules or content, and confirm anything it marks open or leaves unsaid with the human before building it. [The demo plan](docs/plans/poc-demo.md) sets what gets built next. The current art, enemies, and numbers are starting values, not settled design.

## Done

A change is done when `npm run check` is green and:

- every new sim behaviour has a test driving it through `simulateBattle` or another `src/sim/index.ts` export;
- every UI change has been seen working in the running app (`npm run dev`);
- every `electron/` change passes `npm run smoke:electron`. A live process proves nothing here: the window can hang unrendered while Electron keeps running.

## Pull requests

Read [docs/pull-requests.md](docs/pull-requests.md) before creating a branch or opening a PR.

## Agent skills

### Issue tracker

Issues live in GitHub Issues, used through the `gh` CLI. See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

### Triage labels

The five triage roles use their default label names. See [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See [docs/agents/domain.md](docs/agents/domain.md).
