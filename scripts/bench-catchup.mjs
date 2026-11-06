// Measures 12 hours of Ticks under Node, and exits non-zero over the plan's limit (risk R1).
import { createServer } from 'vite';

const LIMIT_MS = 500;
const RUNS = 3;

const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
const { advance, CATCH_UP_CAP_MS, createGame, TICK_MS, viewGame } = await server.ssrLoadModule('/src/sim/index.ts');

const timings = [];
let ticks = 0;
for (let run = 0; run < RUNS; run++) {
  const game = createGame({ seed: run + 1 });
  const start = performance.now();
  advance(game, CATCH_UP_CAP_MS);
  timings.push(performance.now() - start);
  ticks = viewGame(game).tick;
}
await server.close();

if (ticks !== CATCH_UP_CAP_MS / TICK_MS) throw new Error(`expected ${CATCH_UP_CAP_MS / TICK_MS} Ticks, ran ${ticks}`);

const median = [...timings].sort((a, b) => a - b)[Math.floor(RUNS / 2)];
const runs = timings.map((ms) => ms.toFixed(0)).join(', ');
console.log(`bench:catchup: ${ticks} Ticks, median ${median.toFixed(0)} ms (runs: ${runs} ms; limit ${LIMIT_MS} ms)`);
if (median > LIMIT_MS) process.exitCode = 1;
