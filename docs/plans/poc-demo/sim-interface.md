# Sim interface

The numbers and links behind the sim's interface. [`src/sim/index.ts`](../../../src/sim/index.ts) holds the interface itself.

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

100 ms keeps Room timing inside the design's 25–35 seconds, turns seconds into Ticks by multiplying by 10, and gives speed about 3% resolution. [R1](risks.md#r1-12-hours-of-catch-up-blocks-the-ui) tracks the cost.

## The Game

`Game` is plain JSON-safe data that the sim mutates in place, because copying it every Tick would make 432,000 Ticks too slow. The UI never reads inside it: the type is branded, and all reads go through view functions, which return fresh immutable objects.

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

## UI rules

- **Hidden windows:** the driver doesn't step while `document.hidden` is true, since throttled timers fire too rarely and unevenly to tell apart from a real absence. When the window returns, it applies the whole gap under G19.
- **Readable by agents:** the map and panels carry text or `aria-label`s, so the accessibility tree can verify them.
