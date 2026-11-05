# The game runs in a pure, deterministic simulation

All game rules live in `src/sim`, which advances step by step from a starting state, a Seed, and recorded player actions, and reports what happened for the UI to display. We chose this over simulating inside the render loop because it makes bugs reproducible, lets balance be tested headlessly over thousands of Battles, and lets offline progress run the same rules as live play.

Stepping, rather than computing a whole Battle up front, is what lets a player use a consumable mid-Battle. The tracer `simulateBattle` still runs to completion and needs converting.

The cost is that `src/sim` must never touch wall-clock time, unseeded randomness, or anything platform-specific: elapsed offline time arrives as an input. A rule change also changes how existing Seeds play out, so saves store current game state rather than a replay of past actions. `tsconfig.sim.json` and `src/sim/purity.test.ts` enforce the purity.
