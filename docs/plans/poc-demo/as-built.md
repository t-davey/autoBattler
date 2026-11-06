# As built

What merged milestones left for later ones to know. The code holds their rules and numbers. Their original text is in the [plan at 1e59566](https://github.com/t-davey/autoBattler/blob/1e595668bb8380e0d8f1f06b37c6d95e33fb3556/docs/plans/poc-demo.md).

## Milestone 1 ([PR #12](https://github.com/t-davey/autoBattler/pull/12))

- A new game has no Battle until its first Tick, so the first `battleStarted` reaches a sink. Tests that need a Battle advance one Tick first.
- A Team with only a back Row moves forward when a Battle starts.
- `BattleView` has `party` and `enemies`, and `PARTY_TEAM` in `game.ts` is the only link between them and Team ids.
- M3 must decide how `battleEnded.outcome` relates to its `wipe` and `draw` events, so a Setback isn't counted twice.
- `driver.ts` applies no cap, and a returning window runs its whole gap live. M5 moves long gaps to catch-up.
- Save validation lives in `game.ts`, and each new saved field needs a check there.

## Milestone 2 ([PR #14](https://github.com/t-davey/autoBattler/pull/14))

- `UnitSpec`'s `oil`, `maxOil`, `skills`, and `poisonOnHit` are optional, so enemies and stand-ins don't need them.
- `attack` events report `damage` as health lost, with `absorbed` beside it, and a new `effectDamage` event covers Bleed and Poison ticks. M5's main damage type can fold over both. Shared Burden adds a second event, with `redirectedFromName` set.
- On a shared hit, the 1-damage minimum applies only to the original target's share.
- A Hero's Oil carries from a fallen Hero's Unit too. M3 needs to settle this with G7 if it matters.
- `Warm Hands` is learnable but does nothing until M3, and its summary says so. M3 removes that sentence.
- `scripts/balance.mjs` calibrates its stand-in enemies by bisection, so the reference Party stays near 50% as numbers change.
- Two behaviours are temporary until M3: a new Battle follows 50 Ticks after the last ends, and the Party is restored between Battles.
