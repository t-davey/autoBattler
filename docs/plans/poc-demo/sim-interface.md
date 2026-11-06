# Sim interface

The contract for what M3–M5 add. [`src/sim/index.ts`](../../../src/sim/index.ts) holds what M1 and M2 built.

## Tick length: 100 ms

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

100 ms keeps Room timing inside the design's 25–35 seconds, turns seconds into Ticks by multiplying by 10, and gives speed about 3% resolution. **Measured** on the human's machine on 2026-11-05: the tracer `simulateBattle` ran 432,000 Ticks with 7 Units and 100,800 Battle Log entries in 67–81 ms under Node. That is a floor, since it has none of the real rules. [R1](risks.md#r1-12-hours-of-catch-up-blocks-the-ui) tracks the real cost.

## What later milestones add to `src/sim/index.ts`

`Game` is plain JSON-safe data that the sim mutates in place, because copying it every Tick would make 432,000 Ticks too slow. The UI never reads inside it: the type is branded, and all reads go through view functions, which return fresh immutable objects.

```ts
// ---- GameSetup.scenario: starts part-way through, for tests and the balance script ----
readonly startAt?: { readonly floor: 1 | 2 | 3; readonly room: number | 'guardian' }; // M3
readonly lampLit?: boolean;    // M3
readonly equipped?: Readonly<Record<HeroId, readonly ItemSpec[]>>; // M4

// ---- Catch-up (M5) ----
export interface CatchUp { ticksLeft: number; readonly ticksTotal: number; /* plain-data tally; continueCatchUp mutates it */ }
/** Caps elapsedMs at CATCH_UP_CAP_MS and banks it. Runs nothing yet. */
export function beginCatchUp(game: Game, elapsedMs: number): CatchUp;
/** Runs up to maxTicks. Returns the Away Report once ticksLeft reaches 0, else null. */
export function continueCatchUp(game: Game, catchUp: CatchUp, maxTicks: number): AwayReport | null;

// ---- PlayerAction ----
  | { readonly type: 'sendParty' }                                                           // M3
  | { readonly type: 'equipItem'; readonly heroId: HeroId; readonly itemId: ItemId }         // M4
  | { readonly type: 'unequipItem'; readonly heroId: HeroId; readonly slot: Slot };          // M4

// ---- Reads ----
export function viewStash(game: Game): readonly ItemView[]; // M4

// ---- GameView ----
readonly phase: 'town' | 'travelling' | 'battle' | 'chest'; // M3 adds town and chest
readonly heroes: readonly HeroView[];     // M4: equipped items
readonly map: FloorMapView | null;        // M3: Rooms with x, y, kind, state; Party's Room
readonly floor: 1 | 2 | 3 | null;         // M3
readonly townTicksLeft: number | null;    // M3: countdown until the Party leaves Town
readonly wall: { readonly lampLit: boolean; readonly setbacksTowardsFallback: number; readonly fallenBack: boolean }; // M3
readonly stashRevision: number;           // M4: lets the store call viewStash only on change

// ---- Away Report (M5) ----
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

// ---- GameEvent ----
  | { readonly type: 'roomEntered' | 'floorEntered' | 'chestOpened' | 'wipe' | 'draw'
      | 'returnedToTown' | 'partySent' | 'fellBack' | 'retryingGuardian'
      | 'guardianFell' | 'lampRelit'; /* ... */ }     // M3
  | { readonly type: 'itemFound'; /* ItemView */ };   // M4
```

The union's `/* ... */` fields are for the milestone to settle. Add types as they arrive: `Slot`, `ItemId`, `ItemSpec`, `ItemView`.

## How catch-up reuses live stepping

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

## Demo script to exports

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

## UI rules for later milestones

- **Hidden windows:** the driver doesn't step while `document.hidden` is true, since throttled timers fire too rarely and unevenly to tell apart from a real absence. When the window returns, it applies the whole gap under G19.
- **Readable by agents:** the map and panels carry text or `aria-label`s, so the accessibility tree can verify them.
