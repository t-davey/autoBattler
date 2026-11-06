// Measures 12 hours of catch-up under Node, in the chunks the UI uses, and the save it leaves.
// Exits non-zero over docs/plans/poc-demo/risks.md's limits (risk R1 and the save size row).
import { createServer } from 'vite';

const LIMIT_MS = 2_000;
const SAVE_LIMIT_BYTES = 1_000_000;
const SAVE_LIMIT_MS = 20;
const RUNS = 3;
const CHUNK_TICKS = 5_000;

const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
const { beginCatchUp, CATCH_UP_CAP_MS, continueCatchUp, createGame, serializeGame, TICK_MS, viewGame, viewStash } = await server.ssrLoadModule('/src/sim/index.ts');

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const timings = [];
const longestChunks = [];
const saveTimings = [];
const saveSizes = [];
const stashSizes = [];
let ticks = 0;
for (let run = 0; run < RUNS; run++) {
  const game = createGame({ seed: run + 1 });
  const start = performance.now();
  const running = beginCatchUp(game, CATCH_UP_CAP_MS);
  let longest = 0;
  for (let report = null; report === null; ) {
    const chunkStart = performance.now();
    report = continueCatchUp(game, running, CHUNK_TICKS);
    longest = Math.max(longest, performance.now() - chunkStart);
  }
  timings.push(performance.now() - start);
  longestChunks.push(longest);
  ticks = viewGame(game).tick;

  const saveStart = performance.now();
  const saved = serializeGame(game);
  saveTimings.push(performance.now() - saveStart);
  saveSizes.push(saved.length);
  stashSizes.push(viewStash(game).length);
}
await server.close();

if (ticks !== CATCH_UP_CAP_MS / TICK_MS) throw new Error(`expected ${CATCH_UP_CAP_MS / TICK_MS} Ticks, ran ${ticks}`);

const runs = timings.map((ms) => ms.toFixed(0)).join(', ');
console.log(`bench:catchup: ${ticks} Ticks, median ${median(timings).toFixed(0)} ms (runs: ${runs} ms; limit ${LIMIT_MS} ms)`);
console.log(`bench:catchup: longest ${CHUNK_TICKS}-Tick chunk ${Math.max(...longestChunks).toFixed(1)} ms`);
console.log(`bench:catchup: save ${median(saveSizes)} bytes (limit ${SAVE_LIMIT_BYTES}), ${median(saveTimings).toFixed(1)} ms (limit ${SAVE_LIMIT_MS} ms), Stash ${median(stashSizes)} items`);
if (median(timings) > LIMIT_MS || median(saveSizes) > SAVE_LIMIT_BYTES || median(saveTimings) > SAVE_LIMIT_MS) process.exitCode = 1;
