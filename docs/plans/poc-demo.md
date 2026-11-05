# Proof-of-concept demo: implementation plan

**Status: gaps confirmed by the human on 2026-11-05.** Nothing here is built. S2, S3, and S4 under [Human stops](#human-stops) still lie ahead, and G21 still needs each milestone's tables confirmed as it starts.

The demo tests one thing: is it satisfying to come back to loot, make a build decision, and see that decision beat a Wall? Each milestone is a tracer bullet: one PR that leaves the demo runnable end to end.

**How to use this plan:** build one milestone at a time, in order. Before each one, read [AGENTS.md](../../AGENTS.md), [CONTEXT.md](../../CONTEXT.md), [docs/pull-requests.md](../pull-requests.md), and the ADRs its row names under [Code and ADRs by milestone](#code-and-adrs-by-milestone). Every number is a starting value for [Milestone 6](#milestone-6-tuning-and-demo-run) to tune.

## Approved scope

This table overrides [docs/design.md](../design.md) for the demo only. Build nothing from the Cut column.

| Area | In the demo | Cut |
|---|---|---|
| Party | Preset trio: Sin-Eater, Huntsman, Lamplighter; editable names | Hexer, Party creation, multiple Parties |
| Skills | 1 Branch per Class (Bulwark, Bloodletting, Hearth), 3 skills each, plus a basic attack; player-set skill order; free respec | Other Branches, gold respec cost |
| Battles | Rows, Oil, cooldowns, physical and poison damage with resistances | Other damage types, Elites |
| World | Act 1 Floors 1–3, ending in 1 Guardian and 1 Lamp | Other Floors and Acts, Boss, Difficulty Tiers |
| Rooms | Battles and chests on a seeded layout | Traps, shrines, side-room rules |
| Loot | Common, magic, and rare items; about 6 Affixes; weapon, body, and one trinket slot; guaranteed rare on first Guardian kill | Uniques, other slots, Salvage, auto-salvage, Stash cap |
| Setbacks | Wipe returns to Town; fixed Push behaviour (fall back after 3 Wipes, retry on level-up) | Stance toggle, Lamp selection |
| Time | Real-time play, catch-up capped at 12 hours, Away Report | 2x speed, saved history of 10 reports |
| Town | Simple menu to re-send the Party | Merchant, gamble vendor, Belt |
| Platform | Browser via `npm run dev`; existing Electron shell still launches | Installer, auto-update, audio |

Placeholder art: CSS tiles and text glyphs, all original, in the grim gothic tone.

**Milestone order:** kept as approved. Research found no dependency that forces a change.

**Pacing:** the first Wall should take about 1–2 hours of Party time. This is a tunable value, separate from the design's 2-week pacing.

## Demo script

1. Launch and watch the Party clear Rooms on Floor 1, with the Live Log and map running.
2. Skip time. The Away Report shows a Wipe at the Guardian, mostly from poison damage.
3. Open the Stash, equip a new rare, and spend skill points.
4. Skip time or watch live, and see the Guardian fall.
5. The Lamp relights and the guaranteed rare drops.
6. Close the game, reopen it later, and see an Away Report from real elapsed time.

## Human stops

Build stops at each of these until the human answers.

| Stop | When | What the human decides |
|---|---|---|
| **S1: Gaps** | Before each of M1–M4 for G21, and whenever a new gap appears | That milestone's content tables, and any rule this plan leaves unsaid |
| **S2: Skill review** | Milestone 2, after `docs/demo-skills.md` is drafted and before any skill code | Approve or change the 9 skills |
| **S3: Risk fallback** | Whenever a [risk](#risks) threshold trips and number tuning hasn't fixed it | Whether to take a fallback that changes the design or scope |
| **S4: Rehearsal** | End of Milestone 6 | Whether the demo answers its question |

The human alone merges each PR.

### Gaps

The human accepted every answer below on 2026-11-05. G3 and G4 are done. G22 extends the approved scope, by the human's choice.

| # | Gap | Confirmed answer | Needed by |
|---|---|---|---|
| G1 | **Lamplighter damage.** Hearth is healing and wards, and the Class's holy and fire damage are cut. | Its basic attack deals physical damage for the demo. | M1 |
| G2 | **Push fallback.** The design falls back one Lamp, but the demo's only Guardian has no earlier Lamp, so every Run already starts at Floor 1. "Falling back" can only mean no longer challenging the Guardian. | After the 3rd Wipe, Runs still start at Floor 1, but turn back to Town before the Guardian Room. The first Hero level-up during this farming ends it and clears the count, giving 3 fresh attempts. Every Wipe counts, wherever it happens. Level-ups before the 3rd Wipe don't clear the count, because early levels would otherwise stop it ever reaching 3. A Guardian kill also clears it. | M3 |
| G3 | **Plan's home in the docs.** | Add a short demo section to `docs/design.md` linking this plan, once the human approves it. | Before M1 |
| G4 | **Issues.** `docs/pull-requests.md` requires asking before filing. The work spans more than one PR. | File one public issue per milestone. | Before M1 |
| G5 | **Free Class skills.** The design gives each Hero one, but the scope says "3 skills each, plus a basic attack". Consume Sin and Votive Spark deal holy damage, which is cut. Tainted Shaft deals poison, which is in. | Build none. This leaves the Sin-Eater with one active skill, so [risk R2](#r2-9-skills-leave-no-real-build-decision) measures the effect. | M2 |
| G6 | **Points per step.** The confirmed first-playable value is 3 points, so step 3 needs 6 spent and costs 7 points to learn. The first Wall falls at about level 7 (6 points), so no step 3 skill is reachable and each Hero has only 3 legal 6-point builds. | Use 2 points per step in the demo. Step 3 opens at 4 spent, all 9 skills are reachable, and each Hero has 11 legal 6-point builds. | M2 |
| G7 | **Falling in a won Battle.** The design defines a Wipe but not what happens to one dead Hero when the rest win. | The Hero rises at 20% health when the Battle ends and gets the same XP. | M3 |
| G8 | **Drawn Battles.** A healer and a low-damage Team could stall a catch-up for 12 hours. The design allows draws but doesn't say what follows. | A Battle is a draw at 120 seconds (1,200 Ticks). The Party returns to Town. The draw counts towards the 3 Wipes, and the Away Report lists it as a draw. | M1 (cap), M3 (outcome) |
| G9 | **Town and idle play.** A Wipe returns the Party to Town, and the scope has a menu to re-send it. If the Party waited for that click, catch-up would achieve nothing after the first Wipe. | The Party leaves on its own after 10 seconds in Town. The button sends it at once. | M3 |
| G10 | **After the Lamp relights.** Floor 4 is cut, but demo step 6 needs the Party to keep working. | The Party returns to Town and repeats Floors 1–3. The Guardian respawns on each Run and drops one ordinary item. The guaranteed rare drops only once. Town shows the Lamp as lit. | M3 |
| G11 | **Build changes during a Run.** Demo step 3 can happen with the Party mid-Battle. | Player actions apply at any time. Units take their stats and skills at the start of each Battle, so changes reach the next Battle. Health and Oil are clamped to any new maximum. | M2 |
| G12 | **Rows.** The scope has Rows but no way to choose them. | Fixed: Sin-Eater and Huntsman in front, Lamplighter behind. The 60% out-of-Row penalty stays, because a back-Row Hero steps forward when the front Row dies. Row choice is a fallback for R2. | M1 |
| G13 | **Armour and physical resistance.** The stats list has both, with no rule for how they combine. | They multiply: physical damage × `100 / (100 + armour)` × `(1 − resistance / 100)`. Poison damage uses only poison resistance. Resistance caps at 75%. Bleed ignores armour but not physical resistance. | M1 |
| G14 | **Weapon reach.** "Melee skills need a melee weapon" and "reach set by the weapon" need a rule for the back Row. | Weapons are melee or ranged. Melee weapons can be used from either Row, but reach only the enemy front Row. The basic attack has no out-of-Row penalty. A Huntsman holding a ranged weapon can't use its 2 melee skills, and the planning tab says so. The Lamplighter starts with a ranged weapon. | M1 (reach), M4 (equip) |
| G15 | **Poison on Heroes.** The drafted rule says "up to 5 per enemy". | The same rule applies per Unit. Heroes have no way to cure Poison except healing through it and outliving it. | M2 |
| G16 | **Health recovery.** The design says "slowly between rooms" with no number, and doesn't say whether Town heals. | 15% of max health between Rooms. Town restores all health and Oil. | M3 |
| G17 | **XP falloff.** The design has it and the scope doesn't mention it. With only 3 Floors, falloff could stop levelling, and then a fallen-back Party would never retry. | No falloff in the demo. | M2 |
| G18 | **Gold.** Respec cost, merchant, and gamble vendor are all cut, so gold buys nothing. | No gold. Chests hold only items. | M3 |
| G19 | **Short absences.** The design counts a covered or minimized window as away, with no minimum. | A gap of 60 seconds or more gives catch-up and an Away Report. A shorter gap plays through live stepping, with its lines in the Live Log. | M5 |
| G20 | **Saves in Electron.** _Contradicts [ADR 0002](../adr/0002-browser-first-electron-shell.md), which puts saves on disk in Electron, but the approved Milestone 5 brief specifies browser storage and the scope only needs the shell to launch._ | Use `localStorage` everywhere for the demo, behind a small `SaveStore` interface, and leave the ADR unchanged because disk saves remain the plan for release. | M5 |
| G21 | **New content and numbers.** The human owns content, and `docs/first-playable-skills.md` leaves Class stat rates, crit multipliers, and the XP curve to set. This plan proposes those, plus enemies, the Guardian, item bases, Affixes, Rarity odds, and drop rates. | Use each milestone's tables as written, and confirm them at the start of that milestone. | M1, M2, M3, M4 |
| G22 | **Build changes during fallback.** The approved rule retries only on a level-up, so a Party that has fallen back ignores a new build until the next level, up to about 30 minutes at level 6. That delays the moment this demo exists to test. _This extends the approved scope._ | Equipping an item or spending a skill point also ends the fallback and clears the count. | M3, M4 |

## Sim interface

### Tick length: 100 ms

| Quantity | Seconds | Ticks |
|---|---|---|
| Battle Room: 5 s travel + about 25 s Battle | about 30 | about 300 |
| Chest Room: 5 s travel + 20 s search | 25 | 250 |
| Floor: 8–12 Rooms, two-thirds Battles | about 285 | about 2,850 |
| Hero action at base speed | 3 | 30 |
| Poison damage | 2 | 20 |
| Oil regeneration in Battle: 2 per second | 0.5 per Oil | 5 per Oil |
| Battle draw (G8) | 120 | 1,200 |
| Catch-up cap | 43,200 | 432,000 |

100 ms keeps Room timing inside the design's 25–35 seconds, turns seconds into Ticks by multiplying by 10, and gives speed about 3% resolution. **Measured** on the human's machine on 2026-11-05: the tracer `simulateBattle` ran 432,000 Ticks with 7 Units and 100,800 Battle Log entries in 67–81 ms under Node. That is a floor, since it has none of the real rules. [R1](#r1-12-hours-of-catch-up-blocks-the-ui) tracks the real cost.

### Exports from `src/sim/index.ts`

`Game` is plain JSON-safe data that the sim mutates in place, because copying it every Tick would make 432,000 Ticks too slow. The UI never reads inside it: the type is branded, and all reads go through view functions, which return fresh immutable objects.

```ts
// ---- Time (M1) ----
export const TICK_MS = 100;
export const CATCH_UP_CAP_MS = 43_200_000;

// ---- Battle stepping (M1) ----
// The test seam for Battle rules. simulateBattle stays, as a loop over stepBattle.
export function simulateBattle(setup: BattleSetup): BattleResult;
export function createBattle(setup: BattleSetup): BattleState;
export function stepBattle(battle: BattleState): readonly BattleEvent[]; // one Tick

// ---- Game lifecycle (M1; scenario grows in M2-M4) ----
export type Game = { readonly __brand: 'Game' };
export interface GameSetup {
  readonly seed: number;
  /** Starts part-way through, for tests and the balance script. Assert against extremes,
   *  such as level 1 or level 40, so that tuning doesn't break tests. */
  readonly scenario?: {
    readonly heroLevel?: number;   // M2
    readonly skillRanks?: Readonly<Record<HeroId, Readonly<Partial<Record<SkillId, number>>>>>; // M2
    readonly startAt?: { readonly floor: 1 | 2 | 3; readonly room: number | 'guardian' }; // M3
    readonly lampLit?: boolean;    // M3
    readonly equipped?: Readonly<Record<HeroId, readonly ItemSpec[]>>; // M4
  };
}
export function createGame(setup: GameSetup): Game;

// ---- Live stepping (M1) ----
export type EventSink = (event: GameEvent) => void;
/** Banks elapsedMs and runs each whole Tick, reporting events to the sink.
 *  NaN and negative values bank nothing. */
export function advance(game: Game, elapsedMs: number, sink?: EventSink): void;

// ---- Catch-up (M5) ----
export interface CatchUp { ticksLeft: number; readonly ticksTotal: number; /* plain-data tally; continueCatchUp mutates it */ }
/** Caps elapsedMs at CATCH_UP_CAP_MS and banks it. Runs nothing yet. */
export function beginCatchUp(game: Game, elapsedMs: number): CatchUp;
/** Runs up to maxTicks. Returns the Away Report once ticksLeft reaches 0, else null. */
export function continueCatchUp(game: Game, catchUp: CatchUp, maxTicks: number): AwayReport | null;

// ---- Player actions (M2 and later) ----
export type PlayerAction =
  | { readonly type: 'renameHero'; readonly heroId: HeroId; readonly name: string }          // M2
  | { readonly type: 'spendSkillPoint'; readonly heroId: HeroId; readonly skillId: SkillId } // M2
  | { readonly type: 'setSkillOrder'; readonly heroId: HeroId; readonly order: readonly SkillId[] } // M2
  | { readonly type: 'respec'; readonly heroId: HeroId }                                     // M2
  | { readonly type: 'sendParty' }                                                           // M3
  | { readonly type: 'equipItem'; readonly heroId: HeroId; readonly itemId: ItemId }         // M4
  | { readonly type: 'unequipItem'; readonly heroId: HeroId; readonly slot: Slot };          // M4
export type ActionResult = { readonly ok: true } | { readonly ok: false; readonly reason: ActionRefusal };
export function applyAction(game: Game, action: PlayerAction): ActionResult;

// ---- Reads ----
export function viewGame(game: Game): GameView; // M1, growing each milestone
export function viewStash(game: Game): readonly ItemView[]; // M4
export const SAVE_VERSION: number;                          // M1
export function serializeGame(game: Game): string;          // M1
export function deserializeGame(text: string): Game | null; // M1; null on bad data or another SAVE_VERSION

export interface GameView {
  readonly tick: number;
  readonly phase: 'town' | 'travelling' | 'battle' | 'chest';
  readonly battle: BattleView | null;       // Teams, Rows, health, Oil, effects
  readonly heroes: readonly HeroView[];     // M2: name, level, XP, stats, Oil, skills, order, unspent points; M4: equipped items
  readonly map: FloorMapView | null;        // M3: Rooms with x, y, kind, state; Party's Room
  readonly floor: 1 | 2 | 3 | null;         // M3
  readonly townTicksLeft: number | null;    // M3: countdown until the Party leaves Town
  readonly wall: { readonly lampLit: boolean; readonly setbacksTowardsFallback: number; readonly fallenBack: boolean }; // M3
  readonly stashRevision: number;           // M4: lets the store call viewStash only on change
}

export interface AwayReport {
  readonly elapsedMs: number;
  readonly appliedMs: number;
  readonly capped: boolean;
  readonly floorsCleared: number;
  readonly deepestFloor: number;
  readonly setbacks: readonly {
    readonly kind: 'wipe' | 'draw'; // G8
    readonly floor: number;
    readonly enemyName: string;     // the Guardian or the Pack's leading enemy
    readonly mainDamageType: DamageType;
    readonly mainDamageShare: number; // 0-1 of damage the Party took; the text says "mostly" above 0.5
  }[];
  readonly guardianKills: number;
  readonly lampRelit: boolean;
  readonly fellBack: boolean;
  readonly levels: readonly { readonly heroId: HeroId; readonly from: number; readonly to: number }[];
  readonly loot: { readonly common: number; readonly magic: number; readonly rare: number; readonly notable: readonly ItemView[] };
  readonly unspentSkillPoints: number;
}

export type GameEvent =
  | BattleEvent          // M1: attack, death; M2: skill, heal, effect, ward
  | { readonly type: 'battleEnded'; /* ... */ }       // M1
  | { readonly type: 'levelUp'; /* ... */ }           // M2
  | { readonly type: 'roomEntered' | 'floorEntered' | 'chestOpened' | 'wipe' | 'draw'
      | 'returnedToTown' | 'partySent' | 'fellBack' | 'retryingGuardian'
      | 'guardianFell' | 'lampRelit'; /* ... */ }     // M3
  | { readonly type: 'itemFound'; /* ItemView */ };   // M4
```

The union's `/* ... */` fields are for the milestone to settle. Add types as they arrive: `HeroId` (`'sin-eater' | 'huntsman' | 'lamplighter'`), `SkillId`, `DamageType` (`'physical' | 'poison'`), `Slot`, `ItemId`, `ItemSpec`, `ItemView`, `ActionRefusal`.

### How catch-up reuses live stepping

Only one function steps the game, and all rules live beneath it. Live play and catch-up differ only in how they slice time and where events go.

```ts
function stepTick(game: GameState, sink: EventSink): void { /* every rule, reached from here */ }

export function advance(game, elapsedMs, sink = ignore) {
  const ticks = bankElapsed(game, elapsedMs); // adds to game.bankMs, removes whole Ticks
  for (let i = 0; i < ticks; i++) stepTick(game, sink);
}

export function beginCatchUp(game, elapsedMs) {
  const appliedMs = Math.min(sanitise(elapsedMs), CATCH_UP_CAP_MS);
  const ticks = bankElapsed(game, appliedMs);
  return { ticksLeft: ticks, ticksTotal: ticks, elapsedMs, appliedMs, tally: emptyTally() };
}

export function continueCatchUp(game, catchUp, maxTicks) {
  const sink = foldInto(catchUp.tally); // the Away Report is a fold over the same GameEvents
  const n = Math.min(maxTicks, catchUp.ticksLeft);
  for (let i = 0; i < n; i++) stepTick(game, sink);
  catchUp.ticksLeft -= n;
  return catchUp.ticksLeft === 0 ? toAwayReport(catchUp) : null;
}
```

Because the sub-Tick remainder lives in `game.bankMs`, any way of slicing the same elapsed time runs the same Ticks. Catch-up lives in chunks from the start, so the UI can yield between them.

### Demo script to exports

| Demo script step or action | Screen | Exports |
|---|---|---|
| 1. Watch Floor 1 | Dashboard: Battle view, map, Live Log | `createGame`, `advance`, `viewGame`, `GameEvent` |
| 2. Skip time, read the Wipe | Away Report | `beginCatchUp`, `continueCatchUp`, `AwayReport.setbacks` |
| 3. Equip a new rare | Stash | `viewStash`, `applyAction(equipItem / unequipItem)` |
| 3. Spend skill points | Planning tab | `viewGame().heroes`, `applyAction(spendSkillPoint / setSkillOrder / respec)` |
| 4. See the Guardian fall | Dashboard or Away Report | `advance`, or `beginCatchUp` and `continueCatchUp`; `guardianFell` |
| 5. Lamp relights, rare drops | Dashboard, Live Log, or Away Report | `lampRelit`, `itemFound`, `AwayReport.lampRelit`, `AwayReport.loot` |
| 6. Close and reopen | Away Report | `serializeGame`, `deserializeGame`, `beginCatchUp`, `continueCatchUp` |
| Edit a Hero's name | Planning tab | `applyAction(renameHero)` |
| Re-send the Party | Town menu | `viewGame().phase`, `applyAction(sendParty)` |

### UI structure

- **`src/ui/store.ts`** is free of React and the DOM. It holds the `Game`, publishes an immutable snapshot (`GameView`, the Live Log rows capped at 1,000, the current `AwayReport`, catch-up progress), and exposes `subscribe` and `getSnapshot` for `useSyncExternalStore`.
- **`src/ui/driver.ts`** owns the clock. A 100 ms `setInterval` reads `Date.now()` and passes elapsed time to the store, publishing once a pass. `requestAnimationFrame` sets nothing, as [ADR 0003](../adr/0003-react-panels-dom-map.md) requires. `Date.now()` is used because sleep must count as elapsed time.
- **Hidden windows:** the driver doesn't step while `document.hidden` is true, since throttled timers fire too rarely and unevenly to tell apart from a real absence. When the window returns, it applies the whole gap under G19.
- **Start the store and driver outside React**, in `main.tsx`, so effects and Strict Mode can't start 2 loops.
- **Live Log:** use `<ul>`, not `<ol>`, because [the research note](../research/rendering-technology.md#growing-log-and-large-lists) measured `<ol>` as slow to trim. Lines aren't saved.
- **Readable by agents:** the map and panels carry text or `aria-label`s, so the accessibility tree can verify them.

## Research findings the build must respect

- **The Rng can't be saved.** `createRng` keeps its state in a closure. M1 changes it to plain data on `Game`, or saves and the catch-up test can't work.
- **`rng.shuffle(units)` runs every Tick**, even when no Unit acts. M1 shuffles only the Units acting in that Tick, keeping the rule that neither Team gets a first strike.
- **React may not have rendered when the smoke script looks.** `scripts/smoke-electron.mjs` reads `#app` once after `did-stop-loading`, and React's `createRoot().render()` is scheduled. M1 changes it to poll within the existing 15-second limit.
- **`.tsx` tests aren't configured.** `vite.config.ts` and `tsconfig.test.json` include only `src/**/*.test.ts` (plus the config file itself). No component tests are planned: AGENTS.md verifies UI in the running app, and store tests run as plain `.test.ts`. Files those tests import can't use DOM types, because `tsconfig.test.json` has no DOM lib, so `localStorage` access stays in a file they don't import.
- **The purity test bans the word `Date`** anywhere in non-test files under `src/sim`, including comments and content text.
- **Scripts can't import `src/sim` directly with Node**, because its imports have no file extensions. `scripts/*.mjs` load it with Vite's `createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' })` and `ssrLoadModule('/src/sim/index.ts')`. This worked on Vite 8.3.5 with no new dependency (**Measured**).
- **Skills are already drafted.** [docs/first-playable-skills.md](../first-playable-skills.md) covers the 3 Branches, and has confirmed decisions that the demo adapts. It lists forced targeting and damage redirection, both in Bulwark, among the costliest mechanics to build.
- **Heroes deal only physical damage in the demo**, Bleed included. Enemy poison resistance therefore does nothing, so enemies have none.
- **JSON equality:** compare states as `serializeGame` strings. `toEqual` treats `-0` and `0` as different, and JSON doesn't.

## Code and ADRs by milestone

| Milestone | Existing code it changes | ADRs that constrain it |
|---|---|---|
| M1 | `src/sim/battle.ts`, `rng.ts`, `index.ts`, `battle.test.ts`; `src/ui/main.ts` (replaced), `style.css`; `index.html`; `vite.config.ts`; `tsconfig.ui.json`; `package.json`; `scripts/smoke-electron.mjs` | 0001 stepping, purity; 0002 web APIs only; 0003 React, store, Live Log cap, render loop |
| M2 | `src/sim/battle.ts`, `game.ts`, `index.ts`; `src/ui/App.tsx`, store | 0001 skill rules in sim; 0003 panels |
| M3 | `src/sim/game.ts`, `index.ts`; `src/ui/App.tsx`, store | 0001 seeded Floors; 0003 DOM map behind one component |
| M4 | `src/sim/game.ts`, `battle.ts` inputs, `index.ts`; `src/ui/App.tsx`, store | 0001 seeded loot; 0003 list rendering |
| M5 | `src/sim/game.ts`, `index.ts`; `src/ui/driver.ts`, store, `main.tsx` | 0001 elapsed time as input, saves store current state; 0002 storage capability (see G20); 0003 no log flood from catch-up |
| M6 | Content and numbers under `src/sim/content/`; `scripts/` | 0001 headless balance |

## Milestone 1: Live Battle on screen

**PR title:** `feat: show a live Battle from a steppable sim`

**Issue:** [#5](https://github.com/t-davey/autoBattler/issues/5)

**Needs:** G1, G3, G4, G8, G12, G13, G14, G21.

**Create**

- `src/sim/game.ts`, `src/sim/view.ts`, `src/sim/content/enemies.ts`, `src/sim/content/party.ts`, `src/sim/game.test.ts`
- `src/ui/main.tsx`, `App.tsx`, `BattlePanel.tsx`, `LiveLog.tsx`, `store.ts`, `useGame.ts`, `driver.ts`, `describeEvent.ts`, `store.test.ts`
- `scripts/bench-catchup.mjs`

**Change**

- `src/sim/battle.ts`: split into `createBattle` and `stepBattle`, with `simulateBattle` as a loop over them.
- `src/sim/rng.ts`: state becomes plain data.
- `src/sim/index.ts`, `src/sim/battle.test.ts`: new exports; tests move to the new `UnitSpec` fields.
- `src/ui/style.css`, `index.html`: the entry points at `main.tsx`.
- `vite.config.ts`: add `@vitejs/plugin-react`.
- `tsconfig.ui.json`: add `"jsx": "react-jsx"`.
- `package.json`: add `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, and a `bench:catchup` script.
- `scripts/smoke-electron.mjs`: poll `#app` until it has children.

Delete `src/ui/main.ts`. Use the versions the research tested: React 19.3.1 and plugin-react 6.2.1.

**Sim rules**

- **`UnitSpec` fields:** `id`, `name`, `health`, `power`, `actionInterval` (Ticks), `row`, `reach`, `targeting`, `damageType`, `armour`, `resistances`, `critChance`. These replace `hp`, `attack`, and `attackInterval`.
- **Action timing:** a Unit's first action comes one interval into a Battle, as the tracer's does.
- **Damage:** apply G13 and multiply by 1.5 on a critical hit. Damage and health stay fractional, so small Poison stacks still respond to resistance, and the UI rounds for display. A direct hit deals at least 1. Damage over time has no minimum.
- **Reach:** melee reaches only the enemy front Row. Ranged reaches either.
- **Targeting:** seeded random among reachable enemies. Enemies target the front Row first, unless their `targeting` is `any`. The Bone Chanter is the demo's one such enemy, which also gives Shared Burden damage to redirect.
- **Stepping forward:** when a front Row is empty, the back Row steps forward and stays there for the Battle.
- **Battle cap:** a draw at 1,200 Ticks, replacing the tracer's 1,000.
- **Temporary loop, replaced in M3:** a new Battle starts 50 Ticks after the last ends, with the Party restored.

**Party Units** (temporary until M2 adds levels; these are level 1 Heroes with a starter weapon's power included)

| Unit | Row | Reach | Health | Power | Interval | Armour | Crit |
|---|---|---|---|---|---|---|---|
| Sin-Eater | Front | Melee | 160 | 14 | 32 | 20 | 3% |
| Huntsman | Front | Melee | 110 | 17 | 27 | 8 | 8% |
| Lamplighter | Back | Ranged | 95 | 14 | 30 | 5 | 5% |

**Enemies** (Act 1 Floor 1 values; Floors 2 and 3 multiply health and power by 1.4 and 1.9 in M3)

| Enemy | Family | Row | Reach | Health | Power | Interval | Damage | Armour | Physical resistance |
|---|---|---|---|---|---|---|---|---|---|
| Sodden Thrall | Restless dead | Front | Melee | 90 | 3 | 30 | Physical | 5 | 0% |
| Tallow Wight | Restless dead | Front | Melee | 130 | 4 | 35 | Physical | 15 | 10% |
| Bone Chanter | Restless dead | Back | Ranged | 60 | 3 | 30 | Physical | 0 | 0% |
| Mire Bloat | Fungal growth | Front | Melee | 100 | 2 | 30 | Poison | 5 | 20% |
| Sporeling | Fungal growth | Back | Ranged | 55 | 2 | 30 | Poison | 0 | 20% |

A pack is 1–2 front enemies and 1–2 back enemies, drawn from one family. Hand-check: a level 1 Party deals about 15 damage a second, so a 240-health pack lasts about 16–20 seconds.

**Tests** (through `src/sim/index.ts`; the existing `simulateBattle` tests carry over on the new `UnitSpec` fields, except the 1000-Tick cap. `battleEnded` is a `GameEvent`, so the Battle Log's existing shape holds)

- `stepping a Battle to its end matches simulateBattle`
- `caps a Battle at 1200 Ticks as a draw`
- `melee Units can't target the back Row while the front Row lives`
- `the back Row steps forward when the front Row dies`
- `enemies target the front Row first`
- `a Unit with any-Row targeting can hit the back Row`
- `a critical hit deals 1.5 times the damage`
- `a new Battle follows 50 Ticks after the last ends`
- `armour reduces physical damage but not poison damage`
- `resistance reduces only its own damage type and caps at 75%`
- `a hit always deals at least 1 damage`
- `advance runs the same Ticks however elapsed time is sliced` (compares `serializeGame` strings)
- `advance ignores negative and NaN elapsed time`
- `serializeGame round-trips a Game mid-Battle, and the copy plays on identically`
- `deserializeGame returns null for bad data and another SAVE_VERSION`
- In `src/ui/store.test.ts`: `the Live Log keeps the newest 1,000 lines`, and `getSnapshot returns the same object until something changes`

**In `npm run dev`:** the 3 Heroes and a pack stand in their Rows with health bars that move in real time, and the Live Log scrolls as Battles end and restart. Colours are grim gothic tokens in `style.css`.

**`npm run smoke:electron`:** applies, since the page entry and the script change.

**`CONTEXT.md`:** sharpen **Tick** to "the smallest step of game time, 100 ms; within a Battle, each living Unit gets one chance to act in it". Add **Damage type**, **Resistance**, **Armour**, **Reach**, **Pack**, **Family**.

**Acceptance:** `npm run check` and `npm run smoke:electron` pass. `npm run bench:catchup` reports 432,000 Ticks within the [R1](#r1-12-hours-of-catch-up-blocks-the-ui) limit. Over 10 minutes in the running app, no console errors appear and the Live Log holds no more than 1,000 rows.

## Milestone 2: Heroes and skills

**PR title:** `feat: add Hero levels, skills, and a planning tab`

**Issue:** [#6](https://github.com/t-davey/autoBattler/issues/6)

**Needs:** G5, G6, G11, G15, G17, G21.

**Order within the milestone**

1. Write `docs/demo-skills.md`: the 9 skills below, adapted from `docs/first-playable-skills.md`, with durations in Ticks and each adaptation listed.
2. **Stop at S2.** Build no skill code until the human approves the file.
3. Build everything else against the approved file.

**Create**

- `docs/demo-skills.md`
- `src/sim/content/skills.ts`, `src/sim/skills.ts`, `src/sim/skills.test.ts`, `src/sim/heroes.test.ts`
- `src/ui/PlanningTab.tsx`, `describeHero.ts`
- `scripts/balance.mjs`

**Change**

- `src/sim/battle.ts`: add Oil, cooldowns, skills, effects.
- `src/sim/game.ts`, `src/sim/view.ts`, `src/sim/content/party.ts`, `src/sim/index.ts`
- `src/ui/App.tsx`: add tabs. `store.ts`: add `dispatch`. `describeEvent.ts`.
- `package.json`: add a `balance` script.

**Starting skills** (from the confirmed draft; values run evenly from rank 1 to rank 5)

| Branch | Step | Skill | Kind | Row | Reach | Oil | Cooldown (Ticks) | Effect | Fires when |
|---|---|---|---|---|---|---|---|---|---|
| Bulwark | 1 | Bar the Way | Active | Front | Self | 15 | 200 | For 60 Ticks, every single-target enemy attack hits this Hero, and it gains +20% → +60% armour | Another Hero is below 80% health |
| Bulwark | 2 | Iron Penance | Passive | Either | | | | +10% → +30% armour | |
| Bulwark | 3 | Shared Burden | Passive | Front | | | | 10% → 30% of damage to back-Row Heroes goes to this Hero instead | |
| Bloodletting | 1 | Bleeder's Cut | Active | Front | Melee | 10 | | 80% → 110% of power as physical, plus Bleed for 60% → 100% of power over 60 Ticks | A reachable enemy isn't Bleeding |
| Bloodletting | 2 | Open Veins | Passive | Front | | | | +10% → +30% damage to Bleeding enemies | |
| Bloodletting | 3 | The Long Cut | Active | Front | Melee | 20 | 150 | Ends a target's Bleed, dealing all its remaining damage × 150% → 200% | A reachable enemy is Bleeding |
| Hearth | 1 | Mend by Lamplight | Active | Back | Spell | 12 | 60 | Heals the lowest-health-percentage Hero for 120% → 200% of power | A Hero is below 70% health |
| Hearth | 2 | Warm Hands | Passive | Either | | | | The Party recovers 20% → 60% more health between Rooms; only the highest in the Party counts | |
| Hearth | 3 | Lantern Ward | Active | Back | Spell | 20 | 250 | Wards every Hero for 60% → 120% of power for 80 Ticks | No Hero holds a Ward |

**Sim rules**

- **Skill choice:** at each action, a Hero uses the first skill in its order whose Oil, cooldown, and usefulness condition allow it. Otherwise it uses the basic attack: free, 100% of power as physical, reach from the weapon. Since each Hero has at most 2 active skills, the design's limit of 3 never binds and isn't built.
- **Unit spec:** `UnitSpec` gains `oil`, `maxOil`, and `skills`, so `simulateBattle` can drive every rule in tests.
- **Oil:** 100 maximum. In Battle, +1 every 5 Ticks. It carries between Battles, with +30 between Battles.
- **Out-of-Row:** a skill used from the wrong Row has 60% of its numeric effects, with cost and cooldown unchanged.
- **Bleed:** physical over time, ticking every 10 Ticks. It ignores armour. Reapplying replaces it.
- **Poison:** up to 5 stacks per Unit. Each stack deals its damage every 20 Ticks and lasts 100 Ticks. Any new stack refreshes all of them. Poison resistance reduces it. M1's direct poison enemies keep their attacks and also add 1 stack worth 1 damage.
- **Ward:** absorbs all damage types before health, until used up or expired.
- **Levels:** XP to the next level is `15·L² + 45·L` (60, 150, 270, 420, 600, 810, 1,050, 1,320). Each level grants 1 skill point. Every Hero gets each Battle's full XP: 15 until M3 sets it by Floor.
- **Points:** step 2 needs 2 points spent in the Branch and step 3 needs 4 (G6). A skill has 5 ranks.
- **Respec:** free, at any time. It refunds every point and removes unlearned skills from the order.
- **Build changes:** G11.
- **Shared Burden:** redirects direct hits only, not Poison or Bleed damage. Record this in `docs/demo-skills.md` as an adaptation.
- **Temporary between Battles until M3:** health fully restored.

**Class stats** (without gear; the M1 Units' power includes a starter weapon of +4, +3, and +3)

| Class | Health (+per level) | Power (+) | Armour (+) | Speed → interval | Crit | Oil |
|---|---|---|---|---|---|---|
| Sin-Eater | 160 (+16) | 10 (+1) | 20 (+3) | 95 → 32 | 3% | 100 |
| Huntsman | 110 (+10) | 14 (+2) | 8 (+1) | 110 → 27 | 8% | 100 |
| Lamplighter | 95 (+9) | 11 (+1) | 5 (+1) | 100 → 30 | 5% | 100 |

Interval is `round(30 × 100 / speed)`. Until M4 adds items, the starter weapon's power is a Hero-level constant.

**Tests**

- `a Hero uses the first available skill in its order`
- `a Hero with too little Oil falls back to the basic attack`
- `Oil regenerates 1 every 5 Ticks in a Battle and 30 between Battles`
- `a skill on cooldown is skipped until it is ready`
- `Mend by Lamplight doesn't fire when every Hero is above 70% health`
- `Lantern Ward doesn't fire while a Hero holds a Ward`
- `Bleeder's Cut doesn't fire when every reachable enemy is Bleeding`
- `The Long Cut ends a Bleed and deals its remaining damage multiplied`
- `Bleed ignores armour`
- `reapplying Bleed replaces it`
- `Poison stops at 5 stacks and a new stack refreshes them all`
- `poison resistance reduces Poison damage`
- `a Ward absorbs damage before health`
- `Bar the Way forces single-target enemy attacks onto the Hero`
- `Shared Burden redirects part of the damage to back-Row Heroes`
- `a skill used from the wrong Row has 60% of its effects`
- `a Hero gains a level and a skill point at the XP threshold`
- `spending a point is refused below a step's requirement`, `with no points`, and `above rank 5`
- `respec refunds every point and clears unlearned skills from the order`
- `setSkillOrder is refused unless it lists exactly the learned active skills`
- `renameHero trims the name and refuses empty names and names over 24 characters`
- `a build change reaches the next Battle but not the current one`
- `a lower maximum clamps health and Oil`
- `serializeGame round-trips a Game with skills, effects, and cooldowns`

**In `npm run dev`:** Oil bars move, skills appear by name in the Live Log, and points arrive with levels. The planning tab edits names, spends points, reorders skills with up and down buttons, and respecs. A changed order visibly changes what the Hero does in the next Battle.

**`npm run smoke:electron`:** not required, since nothing in `electron/` changes.

**`CONTEXT.md`:** add **Skill point**, **Skill rank** (bare "rank" stays on Row's _Avoid_ list), **Step**, **Skill order**, **Usefulness condition**, **Cooldown**, **Respec**, **Bleed**, **Poison**, **Ward**.

**Acceptance:** the human approved `docs/demo-skills.md`. `npm run check` passes. `npm run balance -- builds` prints the [R2](#r2-9-skills-leave-no-real-build-decision) table and the threshold passes, or S3 has settled it. Renaming, spending a point, reordering, and respeccing have each been seen working in the running app.

## Milestone 3: Floors and the Wall

**PR title:** `feat: send the Party through Floors to a Guardian and Lamp`

**Issue:** [#7](https://github.com/t-davey/autoBattler/issues/7)

**Needs:** G2, G7, G8, G9, G10, G16, G18, G21, G22.

**Create**

- `src/sim/floors.ts`, `src/sim/run.ts`, `src/sim/content/guardian.ts`, `src/sim/floors.test.ts`, `src/sim/run.test.ts`
- `src/ui/FloorMap.tsx`, `TownMenu.tsx`

**Change**

- `src/sim/game.ts`: replace the temporary Battle loop with Runs.
- `src/sim/battle.ts`: separate `maxHealth` from `health`, so health can carry between Rooms, and let a Unit have several timed `actions`, each with its own interval and target (one front-Row Hero, or every Hero).
- `src/sim/view.ts`, `src/sim/index.ts`
- `src/ui/App.tsx`, `describeEvent.ts`, `style.css`

**Sim rules**

- **Layout:** each visit to a Floor draws a new Seed from the Game's Rng. A self-avoiding walk on a 9×7 grid places 8–12 Rooms in order. The Party visits every Room in that order, with no side Rooms.
- **Room kinds:** the last Room holds the stairs and a Battle. Of the others, two-thirds are Battles and one-third chests, shuffled. Floor 3 adds a Guardian Room after its last Room.
- **Room timing:** 50 Ticks of travel into each Room, then a Battle or a 200-Tick chest search. A chest adds a flavour line to the Live Log and holds nothing until M4.
- **Carrying over:** health and Oil carry between Rooms. On leaving a Room, Heroes recover 15% of max health, raised by Warm Hands, and 30 Oil.
- **Enemy scale by Floor:** health and power × 1.0, 1.4, 1.9. XP per Battle: 15, 20, 25. Guardian: 100.
- **Falling in a won Battle:** G7.
- **Wipe:** all progress in the Run ends, with no XP, item, or level lost. The Party returns to Town instantly.
- **Town:** restores all health and Oil. The Party leaves after 100 Ticks (G9), or at once on `sendParty`. `sendParty` is refused outside Town.
- **Every Run starts at Floor 1.**
- **Push:** G2 and G22, with a `fellBack` and a `retryingGuardian` event for the Live Log and Away Report.
- **Lamp:** a Guardian kill relights the Lamp, then the Party returns to Town. After that, G10.

**Guardian:** the Mouldering Warden, alone, in the front Row.

| Health | Armour | Physical resistance | Action | Interval | Effect |
|---|---|---|---|---|---|
| 1,600 | 15 | 0% | Spore Breath | 60 Ticks | 1 Poison stack, worth 3 damage, on every Hero |
| | | | Grave Slam | 80 Ticks | 12 physical to one front-Row Hero |

Hand-check: at 5 stacks, Poison deals 7.5 damage a second to every Hero, so an unhealed level 6 Lamplighter (140 health) dies at about 30 seconds. A level 6 Party's basic attacks need about 85 seconds to kill the Warden. Poison resistance, healing, Wards, and damage all move this. Bar the Way doesn't stop Spore Breath, since it hits every Hero, so the answer can't be a single skill.

**Pacing check** (by hand, before tuning): about 12.7 Floors and 84 Battles an hour give about 1,680 XP an hour. That is level 3 at the first Guardian attempt (15 minutes), level 6 at 1 hour, level 7 at 90 minutes, and level 8 at 2 hours.

**Tests** (use `scenario` so that tuning can't break them)

- `the same Seed produces the same Floor layouts`
- `layouts have 8-12 connected Rooms on the grid across 1,000 Seeds`
- `about two-thirds of Rooms are Battles across many Seeds`
- `Floor 3 ends in a Guardian Room`
- `health and Oil carry between Rooms`
- `a Hero who falls in a won Battle rises at 20% health`
- `Warm Hands raises recovery between Rooms, and only the highest counts`
- `a Wipe returns the Party to Town and keeps XP and levels`
- `Town restores health and Oil, then the Party leaves on its own`
- `sendParty leaves Town at once, and is refused elsewhere`
- `a draw returns the Party to Town and counts towards the 3 Wipes`
- `the 3rd Wipe makes Runs turn back before the Guardian`
- `a level-up during fallback resumes Guardian attempts and clears the count`
- `spending a skill point during fallback resumes Guardian attempts and clears the count`
- `a Guardian kill clears the count`
- `deeper Floors scale enemy health, power, and XP`
- `level-ups before the 3rd Wipe don't clear the count`
- `a level 40 Party kills the Guardian and relights the Lamp`
- `a level 1 Party Wipes at the Guardian, mostly from poison damage`
- `the Guardian respawns on Runs after the Lamp is lit`
- `serializeGame round-trips a Game mid-Run, and the copy plays on identically`

**In `npm run dev`:** the CSS-grid map shows Rooms with glyphs and the Party moving through them. A dev build's `?seed=` query sets the Seed. The Town menu shows on a Wipe, with its button and a countdown. Reaching the Wall needs 15 minutes live, so verify the Guardian, Wipe, and Lamp with a dev-only `?start=guardian` query that passes `scenario` to `createGame`, and with `?level=40` for the kill.

**`npm run smoke:electron`:** not required.

**`CONTEXT.md`:** add **Party time** and **Fall back**. **Lamp** needs no change.

**Acceptance:** `npm run check` passes, and `npm run bench:catchup`, now through full Runs, is within the R1 limit. In the running app, the Party clears Floor 1 from a new game with no Wipe, a `?start=guardian` Party at low level Wipes and returns to Town, and a `?start=guardian&level=40` Party relights the Lamp and starts again from Floor 1.

## Milestone 4: Loot and gear

**PR title:** `feat: add loot, Affixes, and a Stash with manual equip`

**Issue:** [#8](https://github.com/t-davey/autoBattler/issues/8)

**Needs:** G14, G21, G22, plus S3 if R3 trips.

**Create**

- `src/sim/items.ts`, `src/sim/content/items.ts`, `src/sim/items.test.ts`
- `src/ui/StashTab.tsx`, `stashQuery.ts`, `stashQuery.test.ts`

**Change**

- `src/sim/run.ts`, `src/sim/game.ts`, `src/sim/view.ts`, `src/sim/index.ts`
- `src/sim/content/party.ts`: the starter weapons become items.
- `src/ui/App.tsx`, `PlanningTab.tsx`, `describeEvent.ts`
- `scripts/balance.mjs`: add a `drops` mode.

**Sim rules**

- **Slots:** weapon, body, trinket. Any Hero can equip any item that meets its level requirement.
- **Weapon reach:** G14. Equipping a weapon that blocks a learned skill is allowed, and the skill stops being available.
- **Starter gear:** Sin-Eater Iron Cudgel, Huntsman Flensing Knife, Lamplighter Bone Sling, all common. No body or trinket. These replace M2's constant.

| Base | Slot | Reach | Built in |
|---|---|---|---|
| Iron Cudgel | Weapon | Melee | +4 power |
| Flensing Knife | Weapon | Melee | +3 power, +2% crit |
| Bone Sling | Weapon | Ranged | +3 power |
| Rust Mail | Body | | +8 armour |
| Waxed Shroud | Body | | +4 armour, +8% poison resistance |
| Saint's Knuckle | Trinket | | none |

- **Rarity by Floor** (common / magic / rare): 80/18/2, 72/23/5, 62/28/10.
- **Affixes:** common 0, magic 1–2, rare 3–4, with no repeats on one item. Values roll in the range below, scaled by Floor (× 1.0, 1.2, 1.4), and round to whole numbers.

| Affix | Effect | Range |
|---|---|---|
| Keen | +power | 1–4 |
| Hale | +max health | 10–30 |
| Iron-bound | +armour | 4–12 |
| Sallow | +poison resistance | 6–15% |
| Cruel | +critical chance | 2–6% |
| Swift | +speed | 3–8 |

- **Level requirement:** Floor 1: level 1. Floor 2: level 3. Floor 3: level 4. A rare adds 1.
- **Drops:** a chest holds an item 60% of the time, a Battle 10%, and a Guardian kill always. This gives about 32 items and 1.8 rares an hour.
- **First Guardian kill:** the drop is always rare, once per Game, whatever the Rarity roll.
- **Stash:** loot lands there straight away, with no limit. Equipping swaps the old item back into it.

**Tests**

- `the same Seed produces the same items`
- `items roll Affix counts by rarity with no repeats`
- `Rarity odds match each Floor's table across many Seeds`
- `a chest, a Battle, and a Guardian kill can each add an item to the Stash`
- `the first Guardian kill drops a rare, and later kills may not`
- `equipItem is refused below the level requirement`
- `equipItem swaps the old item back into the Stash`
- `equipping an item during fallback resumes Guardian attempts`
- `unequipItem returns the item to the Stash`
- `equipped gear changes a Hero's stats in the next Battle`
- `a Sallow item reduces Poison damage in Battle`
- `a ranged weapon makes melee skills unavailable`
- `an unknown itemId is refused and changes nothing`
- `serializeGame round-trips a Game with items`
- In `src/ui/stashQuery.test.ts`: `sorts by newest, rarity, and level requirement`, and `filters by slot, rarity, and Affix`

Sort and filter live in `src/ui/stashQuery.ts`: they are presentation, with no effect on rules.

**In `npm run dev`:** items appear in the Live Log, coloured by rarity, as they drop. The Stash tab sorts and filters, including by "poison resistance". Equipped gear sits beside the list for manual comparison, with no upgrade button, as the design says. Equip a Sallow item and the Hero's poison resistance rises on its stat sheet.

**`npm run smoke:electron`:** not required.

**`CONTEXT.md`:** add **Item**, **Rarity**, **Slot**, **Level requirement**.

**Acceptance:** `npm run check` passes. `npm run balance -- drops` prints the [R3](#r3-6-affixes-make-drops-feel-samey) table and the threshold passes, or S3 has settled it. In the running app, a `?start=guardian&level=40` Party's first kill puts a rare in the Stash, and equipping it changes the stat sheet.

## Milestone 5: Catch-up and Away Report

**PR title:** `feat: catch up from elapsed time with an Away Report`

**Issue:** [#9](https://github.com/t-davey/autoBattler/issues/9)

**Needs:** G19, G20.

**Create**

- `src/sim/catchup.ts`, `src/sim/catchup.test.ts`
- `src/ui/AwayReportPanel.tsx`, `save.ts` (the `SaveStore` interface and envelope), `localStorageSave.ts`, `save.test.ts`, `driver.test.ts`

**Change**

- `src/sim/game.ts`, `src/sim/index.ts`
- `src/ui/driver.ts`, `store.ts`, `main.tsx`, `App.tsx`, `TownMenu.tsx` (Lamp state)
- `scripts/bench-catchup.mjs`

**Sim rules**

- Catch-up as in [How catch-up reuses live stepping](#how-catch-up-reuses-live-stepping), capped at 12 hours. The Away Report is a fold over `GameEvent`s and adds nothing to `Game`.
- A Wipe's main damage type is the type that dealt the largest share of damage the Party took in that Battle, including damage a Ward absorbed.
- Elapsed time always comes in as an argument. `src/sim` never reads a clock.

**UI rules**

- **Envelope:** `{ savedAt, game: string }`, where `deserializeGame` alone checks the version. `savedAt` is the time the state was last advanced to, not the time of writing, so writes can't lose or double-count time.
- **When to save:** every 30 seconds, on `visibilitychange` to hidden, on `pagehide`, after a player action, and after catch-up finishes. Never save during catch-up, because `beginCatchUp` has already banked the time. Closing part-way restarts from the last save, with nothing lost.
- **On load:** elapsed is `Date.now() − savedAt`. At 60 seconds or more, run catch-up and show the Away Report. Under that, step live. A clock moved backwards gives 0.
- **Bad saves:** an unreadable or old save moves to `autobattler.save.bad`, the game starts new, and a notice says so. A `setItem` failure shows a visible warning and is never swallowed.
- **Running catch-up:** call `continueCatchUp` in chunks of 5,000 Ticks, yield with `setTimeout(0)` after 16 ms of work, and show progress. Live stepping pauses and player actions wait until it finishes. Catch-up adds no Live Log lines, apart from one line pointing at the Away Report.
- **Away Report contents:** elapsed and applied time, a note if capped, Floors cleared, deepest Floor, Wipes and causes ("2 Wipes at the Mouldering Warden, mostly poison damage"), Guardian kills, Lamp relit, fall-back note, levels gained, loot counts, rares by name, and unspent skill points, with links to the Stash and planning tabs. It's held in memory only, and dismissed by the player.
- **Skip button:** a "Skip 1 hour" button, rendered only under `import.meta.env.DEV`, calls the same store method as a return from absence, with 3,600,000 ms.
- **Start over:** a dev-only button clears the save, for rehearsals.
- **Starting Seed:** a constant `DEMO_SEED` in `main.tsx`, which M6 chooses. `?seed=` overrides it in dev.

**Tests**

- `catch-up and live play reach identical state for the same Seed and elapsed time`: Seeds 1–5 at 1 hour, with live play cut into uneven slices (16, 33, 100, 1,000, 7,000 ms, repeating), comparing `serializeGame` strings
- `catch-up and live play stay identical over 12 hours`: one Seed, with a long timeout
- `catch-up and live play stay identical when the same action lands on the same Tick`
- `catch-up gives the same result in any chunk size`
- `catch-up stops at the 12-hour cap and the Away Report says so`
- `catch-up treats negative and NaN elapsed time as none`
- `the Away Report counts Floors, Wipes, levels, and loot from the same events as live play`
- `the Away Report names poison as the main damage type of a Guardian Wipe`
- `the Away Report notes a fall back and a relit Lamp`
- `a Game restored from serializeGame plays on identically after a Wipe, in Town, and mid-Battle`
- In `src/ui/driver.test.ts`, with the clock and window visibility injected, so `driver.ts` needs no DOM types: `a gap of 60 seconds or more runs catch-up`, `a shorter gap steps live`, `nothing steps while the window is hidden`, and `nothing saves during catch-up`
- In `src/ui/save.test.ts`, with an in-memory `SaveStore`: `savedAt is the time state was last advanced to`, `an old version moves aside and starts a new game`, and `a failed write raises a warning`

**In `npm run dev`:** "Skip 1 hour" shows a progress indicator and then the Away Report. Close the tab, wait 2 minutes, and reopen: the Away Report reports about 2 minutes. Cover the window for over 60 seconds, return, and the same happens. The Live Log doesn't flood.

**`npm run smoke:electron`:** applies as a check that the save code doesn't break the shell under `file://`, even though `electron/` doesn't change. The app must still render if `localStorage` throws.

**`CONTEXT.md`:** add **Catch-up** (_Avoid_: offline progress, fast-forward).

**Acceptance:** `npm run check` and `npm run smoke:electron` pass. The R1 measurements are recorded in the PR and are under their limits, or the Worker fallback is in. `dist/` holds no "Skip 1 hour" text after `npm run build`. Demo script step 6 works in the running app, using a real absence of at least 2 minutes.

## Milestone 6: Tuning and demo run

**PR title:** `chore: tune the first Wall across many Seeds`

**Issue:** [#10](https://github.com/t-davey/autoBattler/issues/10)

**Create**

- `docs/plans/poc-demo-results.md`: balance tables and the rehearsal record.

**Change**

- `scripts/balance.mjs`: add a `wall` mode.
- `src/sim/content/*`: numbers only.
- `src/ui/main.tsx`: `DEMO_SEED`.
- Tests only where they pin a number that tuning moves. Prefer changing them to extremes.

**Balance script:** `npm run balance -- wall` runs 200 Seeds headlessly, with 3 scripted players driving `advance` and `applyAction` for 2 hours of Party time:

- **Untended:** no actions at all.
- **Points only:** at 60 minutes, spends all points on a reference build.
- **Answer:** at 60 minutes, spends the same points and equips the Stash's highest poison resistance per slot that levels allow.

**Targets** (each is pass or fail, and the run reports them all)

| Measure | Target |
|---|---|
| Median Battle length, Floors 1–3 | 20–30 s |
| Median Floor length | 4–6 min |
| Party time to first Guardian attempt, median | 13–20 min |
| New Party Wipes in first 5 minutes | Under 5% of Seeds |
| At least one rare by 60 minutes | At least 80% of Seeds |
| Guardian Wipes where poison is the main damage type | At least 90% |
| Untended: Guardian killed within 2 hours | At most 10% of Seeds |
| Answer: Guardian killed within 2 hours | At least 80% of Seeds |
| Answer: median first kill | 60–120 min |
| Points only: Guardian kill rate | At least 20 points below Answer |

The last 2 rows carry the demo's question: the build decision has to be what beats the Wall. Tune in this order: Guardian health, Poison stack damage, poison resistance range, enemy scale, XP curve, drop rates.

**Demo Seed:** choose a `DEMO_SEED` where, on 1 hour of Party time from a new game: the Away Report shows a Guardian Wipe mostly from poison damage; the Stash holds a usable rare with Sallow; and spending points plus equipping it beats the Guardian within the next hour.

**Rehearsal:** run all 6 demo script steps in `npm run dev` from a cleared save, using "Skip 1 hour" for step 4 unless time allows the 15 or more minutes a live Run takes, and record each step's result and time in `docs/plans/poc-demo-results.md`. Then **stop at S4** for the human to run it.

**Tests:** none new beyond `npm run check`, since this PR adds no rules. A rule change found in tuning gets its own test and, if it's a design change, S1.

**In `npm run dev`:** all 6 steps.

**`npm run smoke:electron`:** applies, as the final check that the Electron shell launches.

**`CONTEXT.md`:** no new terms expected.

**Title:** add `!` if the PR's changes stop M5 saves loading, and say so under Saves in the PR body. Changing numbers alone doesn't stop them loading.

**Acceptance:** `npm run check` and `npm run smoke:electron` pass. Every row in the targets table passes, or the human accepted the miss in writing at S3. The 6-step rehearsal passes with `DEMO_SEED`. The human gave a verdict at S4.

## Risks

Number tuning always comes first. A fallback that changes rules, scope, or design stops at S3.

### R1: 12 hours of catch-up blocks the UI

| When | Measurement | Threshold that triggers action |
|---|---|---|
| M1 | `npm run bench:catchup`: 432,000 Ticks of continuous Battles under Node, median of 3 runs (the bare tracer was 67–81 ms) | Over 500 ms: remove per-Tick allocation before starting M2 |
| M3 | The same, through full Runs | Over 2 s: profile and fix before starting M4 |
| M5 | In a browser, with `PerformanceObserver` on `longtask`, from a 12-hour save | Total over 10 s, or any task over 100 ms: take the fallback |

**Fallback:** move catch-up to a Web Worker. The sim has no DOM, so the Worker runs `deserializeGame`, `beginCatchUp`, and `continueCatchUp`, and posts back the state and the Away Report. It costs one new file and a Vite worker import. Never approximate 12 hours with a summary formula, since [ADR 0001](../adr/0001-deterministic-sim-core.md) requires that catch-up run the same rules.

**Equivalence tests:** `advance runs the same Ticks however elapsed time is sliced` (M1) and `catch-up and live play reach identical state for the same Seed and elapsed time` (M5). A failure in either stops the milestone, whichever fallback is in use.

### R2: 9 skills leave no real build decision

Only 5 of the 9 skills are active, and the Sin-Eater has just 1, so skill order is a real choice for 2 Heroes at most.

**Measured in M2**, re-measured in M6 against the real Guardian. `npm run balance -- builds` runs, for each Class, all legal 6-point allocations and skill orders with the other 2 Heroes on reference builds, over 200 Seeds, against 2 stand-in Battles: a 4-enemy physical pack and a poison-leaning single enemy. Stand-in numbers are set so the reference Party wins about half the time. A build is **viable** if its win rate is within 10 points of the Class's best in that Battle.

**Fallback triggers if any of these holds:**

- A Class has fewer than 2 viable builds whose highest-ranked skills differ.
- Every Class's best build is the same in both Battles.
- A skill never appears with a rank in any viable build.

**Fallback, in order:**

1. Change skill numbers.
2. Let the player choose each Hero's Row (S3), which also makes the out-of-Row penalty a real choice.
3. Add Tainted Shaft, the Huntsman's poison skill, giving it a third active and a Row trade-off (S3).

### R3: 6 Affixes make drops feel samey

**Measured in M4**, re-measured in M6. `npm run balance -- drops` runs 2 hours of Party time over 200 Seeds and reports:

- **Decision drops per hour:** items better than a Hero's current item on at least one stat and worse on another, for at least one Hero.
- **Dominated pairs:** the share of same-slot rare pairs where one is at least as good on every stat.
- **Poison share:** the share of rares with Sallow.

**Fallback triggers if** there are fewer than 2 decision drops per hour, more than 40% dominated pairs, or a poison share outside 30–80%.

**Fallback, in order:**

1. Widen Affix ranges.
2. Weight Affixes by Slot, such as Keen on weapons and Hale on body armour.
3. Add up to 2 Affixes from stats already in scope, max Oil and physical resistance (S3, since it stretches "about 6").

### Other risks found in research

| Risk | Milestone that measures it | Threshold | Fallback |
|---|---|---|---|
| Uncapped Stash bloats saves, since Salvage and a cap are cut | M5: `serializeGame` length and time after 12 hours | Over 1 MB or 20 ms | Save only on `visibilitychange`, `pagehide`, and every 60 s |
| Long Stash list lags | M5: Stash tab holding a 12-hour Stash, about 400 items | A sort or filter over 100 ms | `content-visibility: auto` on rows, as the research note suggests |
| The demo Seed stops working as rules change | M6 | Rehearsal fails | Re-run the Seed search |

## Coverage audit

| In the demo | Milestone |
|---|---|
| Preset trio: Sin-Eater, Huntsman, Lamplighter | M1 (Units), M2 (Heroes) |
| Editable names | M2 |
| Bulwark, Bloodletting, Hearth: 3 skills each | M2 |
| Basic attack | M1, M2 |
| Player-set skill order | M2 |
| Free respec | M2 |
| Rows | M1 |
| Oil | M2 |
| Cooldowns | M2 |
| Physical and poison damage with resistances | M1 (direct), M2 (Poison) |
| Act 1 Floors 1–3 | M3 |
| 1 Guardian and 1 Lamp | M3 |
| Battles and chests on a seeded layout | M3 (chest contents: M4) |
| Common, magic, and rare items | M4 |
| About 6 Affixes | M4 |
| Weapon, body, and one trinket slot | M4 |
| Guaranteed rare on first Guardian kill | M4 |
| Wipe returns to Town | M3 |
| Fixed Push behaviour | M3 |
| Real-time play | M1 |
| Catch-up capped at 12 hours | M5 |
| Away Report | M5 |
| Simple Town menu to re-send the Party | M3 |
| Browser via `npm run dev` | M1 |
| Existing Electron shell still launches | M1, M5, M6 |
| Placeholder art: CSS tiles and text glyphs | M1, M3 |
| Steppable sim | M1 |
| Store free of React | M1 |
| Capped Live Log | M1 |
| First-available skill rule and usefulness conditions | M2 |
| XP, levels, skill points, Class stats | M2 |
| Health and Oil carrying between Rooms | M3 |
| Level requirements, Stash with sort and filter, manual equip | M4 |
| Poison resistance gear as a visible answer | M4, M6 |
| Save and load through browser storage | M5 |
| Dev-only "skip 1 hour" | M5 |
| Headless balance script | M2 (first modes), M6 (`wall`) |
| About 1–2 hours of Party time to the first Wall | M6 |

| Demo script step | Works from | Proven by M6 rehearsal |
|---|---|---|
| 1. Watch the Party clear Rooms on Floor 1, with Live Log and map | M3 | Yes |
| 2. Skip time; Away Report shows a Guardian Wipe, mostly poison | M5 (needs M3's Guardian) | Yes |
| 3. Open the Stash, equip a new rare, spend skill points | M4 (points: M2) | Yes |
| 4. Skip time or watch live; Guardian falls | M5 (live: M3) | Yes |
| 5. Lamp relights, guaranteed rare drops | M4 (Lamp: M3) | Yes |
| 6. Close, reopen, Away Report from real elapsed time | M5 | Yes |

**Cut column check:** nothing here builds a Cut item. No Hexer, Party creation, other Branches, gold, other damage types, Elites, other Floors, Boss, Difficulty Tiers, traps, shrines, side-room rules, uniques, other slots, Salvage, Stash cap, Stance toggle, Lamp selection, 2x speed, saved report history, merchant, gamble vendor, Belt, installer, auto-update, or audio. Free Class skills (G5) and XP falloff (G17) aren't in the Cut column, but the recommended answers leave them out too.

## Each PR

Follow [docs/pull-requests.md](../pull-requests.md) in full: branch from the latest `main`, reach Done, check scope, review with `mattpocock-skills:code-review`, and fill in the template, including its Saves, Gameplay, and Docs lines. No milestone before M5 has saves, so none needs `!`. Put "Closes" and the milestone's issue in the PR body. Ask before filing any new issue.
