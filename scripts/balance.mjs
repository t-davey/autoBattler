// Headless balance measurements. `builds` measures risk R2 and `drops` measures risk R3, both in
// docs/plans/poc-demo/risks.md. Each exits non-zero if a trigger trips.
import { createServer } from 'vite';

const SEEDS = 200;
const LEVEL = 7;
const POINTS = LEVEL - 1;
const MAX_RANK = 5;
const POINTS_PER_STEP = 2;
const VIABLE_WITHIN = 10;
const CALIBRATION_STEPS = 12;

/** Each Class's skills in step order, with which are active. */
const CLASSES = {
  'sin-eater': { skills: ['bar-the-way', 'iron-penance', 'shared-burden'], actives: ['bar-the-way'] },
  huntsman: { skills: ['bleeders-cut', 'open-veins', 'the-long-cut'], actives: ['bleeders-cut', 'the-long-cut'] },
  lamplighter: { skills: ['mend-by-lamplight', 'warm-hands', 'lantern-ward'], actives: ['mend-by-lamplight', 'lantern-ward'] },
};

/** G25: only this measurement uses them. */
const REFERENCE_RANKS = {
  'sin-eater': [2, 2, 2],
  huntsman: [2, 2, 2],
  lamplighter: [4, 0, 2],
};

/** G27: Warm Hands never acts in a single Battle, so it can't count against a build. */
const JUDGED_ELSEWHERE = new Set(['warm-hands']);

const enemy = (id, row, overrides) => ({
  id,
  name: id,
  row,
  reach: 'melee',
  targeting: 'frontFirst',
  damageType: 'physical',
  armour: 5,
  resistances: {},
  critChance: 0,
  ...overrides,
});

/** Stand-in Battles at a strength. Calibration finds the strength the reference Party wins half of. */
const STAND_INS = {
  'physical Pack': (scale) => [
    enemy('Thrall A', 'front', { health: 150 * scale, power: 8 * scale, actionInterval: 30 }),
    enemy('Thrall B', 'front', { health: 150 * scale, power: 8 * scale, actionInterval: 30 }),
    enemy('Chanter A', 'back', { health: 80 * scale, power: 6 * scale, actionInterval: 30, reach: 'ranged', targeting: 'any' }),
    enemy('Chanter B', 'back', { health: 80 * scale, power: 6 * scale, actionInterval: 30, reach: 'ranged', targeting: 'any' }),
  ],
  'poison-leaning enemy': (scale) => [
    enemy('Rotting Hulk', 'front', {
      health: 700 * scale,
      power: 6 * scale,
      actionInterval: 20,
      reach: 'ranged',
      targeting: 'any',
      damageType: 'poison',
      poisonOnHit: 3 * scale,
    }),
  ],
};

/** Every legal allocation of the points across a Branch's 3 steps. */
function legalAllocations() {
  const allocations = [];
  for (let first = 0; first <= MAX_RANK; first++) {
    for (let second = 0; second <= MAX_RANK; second++) {
      const third = POINTS - first - second;
      if (third < 0 || third > MAX_RANK) continue;
      if (second > 0 && first < POINTS_PER_STEP) continue;
      if (third > 0 && first + second < 2 * POINTS_PER_STEP) continue;
      allocations.push([first, second, third]);
    }
  }
  return allocations;
}

const ranksFrom = (skills, allocation) =>
  Object.fromEntries(skills.flatMap((skill, index) => (allocation[index] > 0 ? [[skill, allocation[index]]] : [])));

/** Each allocation, once for each order of its learned active skills. */
function buildsFor(heroId) {
  const { skills, actives } = CLASSES[heroId];
  return legalAllocations().flatMap((allocation) => {
    const ranks = ranksFrom(skills, allocation);
    const learned = actives.filter((skill) => ranks[skill]);
    const orders = learned.length === 2 ? [learned, [...learned].reverse()] : [learned];
    return orders.map((order) => ({ allocation, ranks, order }));
  });
}

const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
const { advance, applyAction, createGame, partyUnitSpecs, simulateBattle, viewGame } = await server.ssrLoadModule('/src/sim/index.ts');

const referenceRanks = Object.fromEntries(
  Object.entries(REFERENCE_RANKS).map(([heroId, allocation]) => [heroId, ranksFrom(CLASSES[heroId].skills, allocation)]),
);

function partyWith(heroId, build) {
  const skillRanks = heroId ? { ...referenceRanks, [heroId]: build.ranks } : referenceRanks;
  const game = createGame({ seed: 1, scenario: { heroLevel: LEVEL, skillRanks } });
  if (heroId) applyAction(game, { type: 'setSkillOrder', heroId, order: build.order });
  return partyUnitSpecs(game);
}

function winRate(party, enemies) {
  let wins = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    if (simulateBattle({ seed, teams: { a: party, b: enemies } }).winner === 'a') wins++;
  }
  return (wins / SEEDS) * 100;
}

/** Bisects for the strength where the reference Party wins about half its Battles. */
function calibrate(makeEnemies) {
  const party = partyWith(null);
  let low = 0.1;
  let high = 10;
  for (let step = 0; step < CALIBRATION_STEPS; step++) {
    const middle = Math.sqrt(low * high);
    if (winRate(party, makeEnemies(middle)) > 50) low = middle;
    else high = middle;
  }
  return Math.sqrt(low * high);
}

/** The skills holding a build's highest rank. */
function topSkills(heroId, build) {
  const top = Math.max(...build.allocation);
  return CLASSES[heroId].skills.filter((_, index) => build.allocation[index] === top).join('+');
}

const buildName = (build) => `${build.allocation.join('/')}${build.order.length === 2 ? ` ${build.order[0]} first` : ''}`;

function measureBuilds() {
  const battles = Object.entries(STAND_INS).map(([name, makeEnemies]) => {
    const scale = calibrate(makeEnemies);
    return { name, scale, enemies: makeEnemies(scale), reference: winRate(partyWith(null), makeEnemies(scale)) };
  });

  const results = {};
  for (const heroId of Object.keys(CLASSES)) {
    const builds = buildsFor(heroId).map((build) => {
      const party = partyWith(heroId, build);
      return { ...build, rates: battles.map(({ enemies }) => winRate(party, enemies)) };
    });
    results[heroId] = builds;
  }

  console.log(`R2 builds: level ${LEVEL}, ${POINTS} points, ${SEEDS} Seeds per Battle`);
  for (const battle of battles) {
    console.log(`  ${battle.name}: strength ×${battle.scale.toFixed(2)}, reference Party wins ${battle.reference.toFixed(0)}%`);
  }

  const failures = [];
  const viableSkills = new Set();
  const bestIn = {};

  for (const [heroId, builds] of Object.entries(results)) {
    const bests = battles.map((_, index) => Math.max(...builds.map((build) => build.rates[index])));
    const worsts = battles.map((_, index) => Math.min(...builds.map((build) => build.rates[index])));
    const isViable = (build, index) => build.rates[index] >= bests[index] - VIABLE_WITHIN;

    console.log(`\n${heroId} (${CLASSES[heroId].skills.join(' / ')})`);
    console.log(`  ${'build'.padEnd(34)}${battles.map(({ name }) => name.padEnd(24)).join('')}`);
    for (const build of builds) {
      const cells = battles.map((_, index) => `${build.rates[index].toFixed(0).padStart(3)}%${isViable(build, index) ? ' viable' : ''}`.padEnd(24));
      console.log(`  ${buildName(build).padEnd(34)}${cells.join('')}`);
    }
    battles.forEach(({ name }, index) => {
      console.log(`  ${name}: best ${bests[index].toFixed(0)}%, worst ${worsts[index].toFixed(0)}%, spread ${(bests[index] - worsts[index]).toFixed(0)} points`);
    });

    const viable = builds.filter((build) => battles.some((_, index) => isViable(build, index)));
    const distinctTops = new Set(viable.map((build) => topSkills(heroId, build)));
    if (distinctTops.size < 2) failures.push(`${heroId} has fewer than 2 viable builds whose highest-ranked skills differ`);
    for (const build of viable) for (const skill of Object.keys(build.ranks)) viableSkills.add(skill);

    bestIn[heroId] = battles.map((_, index) => buildName(builds.find((build) => build.rates[index] === bests[index])));
  }

  if (Object.values(bestIn).every(([first, second]) => first === second)) {
    failures.push("every Class's best build is the same in both Battles");
  }
  for (const { skills } of Object.values(CLASSES)) {
    for (const skill of skills) {
      if (!JUDGED_ELSEWHERE.has(skill) && !viableSkills.has(skill)) failures.push(`${skill} never appears with a rank in a viable build`);
    }
  }

  console.log('');
  if (failures.length === 0) {
    console.log('R2: PASS. No trigger tripped. Read the spreads too: a flat Class passes without a real decision.');
  } else {
    for (const failure of failures) console.log(`R2: TRIPPED. ${failure}.`);
    process.exitCode = 1;
  }
}

const DROP_HOURS = 2;
const DROP_STEP_MS = 1_000;
const MIN_DECISION_DROPS_PER_HOUR = 2;
const MAX_DOMINATED_SHARE = 40;
const POISON_SHARE_RANGE = [30, 80];
const EMPTY_SLOT_STATS = { power: 0, maxHealth: 0, armour: 0, poisonResistance: 0, critChance: 0, speed: 0 };

const statsOf = (stats) => Object.keys(EMPTY_SLOT_STATS).map((stat) => stats[stat]);
const atLeastAsGood = (a, b) => statsOf(a).every((value, index) => value >= statsOf(b)[index]);
const isTradeOff = (a, b) => !atLeastAsGood(a, b) && !atLeastAsGood(b, a);

/** Spends each point as it comes, on the first skill that takes it. */
function spendPoints(game) {
  for (const hero of viewGame(game).heroes) {
    let left = hero.unspentPoints;
    for (const skillId of CLASSES[hero.id].skills) {
      while (left > 0 && applyAction(game, { type: 'spendSkillPoint', heroId: hero.id, skillId }).ok) left--;
    }
  }
}

/** Plays like a player who equips plain upgrades and leaves trade-offs in the Stash. Same Reach only, so no skill is lost. */
function equipUpgrade(game, item) {
  for (const hero of viewGame(game).heroes) {
    const current = hero.equipment[item.slot];
    const held = current?.stats ?? EMPTY_SLOT_STATS;
    const upgrade = atLeastAsGood(item.stats, held) && !atLeastAsGood(held, item.stats);
    const sameReach = item.reach === null || current === null || item.reach === current.reach;
    if (hero.level >= item.levelRequirement && upgrade && sameReach) {
      applyAction(game, { type: 'equipItem', heroId: hero.id, itemId: item.id });
      return;
    }
  }
}

/** Better than a Hero's current item on one stat and worse on another. */
const isDecision = (game, item) =>
  viewGame(game).heroes.some((hero) => {
    const current = hero.equipment[item.slot];
    return hero.level >= item.levelRequirement && current !== null && isTradeOff(item.stats, current.stats);
  });

function measureDrops() {
  const counts = { common: 0, magic: 0, rare: 0 };
  const raresBySlot = { weapon: [], body: [], trinket: [] };
  let decisions = 0;
  let sallowRares = 0;
  const relitAt = [];

  for (let seed = 1; seed <= SEEDS; seed++) {
    const game = createGame({ seed });
    for (let elapsed = 0; elapsed < DROP_HOURS * 3_600_000; elapsed += DROP_STEP_MS) {
      const found = [];
      advance(game, DROP_STEP_MS, (event) => {
        if (event.type === 'itemFound') found.push(event.item);
        if (event.type === 'lampRelit') relitAt.push(elapsed / 60_000);
      });
      spendPoints(game);
      for (const item of found) {
        counts[item.rarity]++;
        if (isDecision(game, item)) decisions++;
        if (item.rarity === 'rare') {
          raresBySlot[item.slot].push(item.stats);
          if (item.affixes.includes('sallow')) sallowRares++;
        }
        equipUpgrade(game, item);
      }
    }
  }

  let pairs = 0;
  let dominated = 0;
  for (const rares of Object.values(raresBySlot)) {
    for (let i = 0; i < rares.length; i++) {
      for (let j = i + 1; j < rares.length; j++) {
        pairs++;
        if (!isTradeOff(rares[i], rares[j])) dominated++;
      }
    }
  }

  const hours = SEEDS * DROP_HOURS;
  const total = counts.common + counts.magic + counts.rare;
  const decisionsPerHour = decisions / hours;
  const dominatedShare = pairs === 0 ? 0 : (dominated / pairs) * 100;
  const poisonShare = counts.rare === 0 ? 0 : (sallowRares / counts.rare) * 100;

  console.log(`R3 drops: ${DROP_HOURS} hours of Party time over ${SEEDS} Seeds, spending points and equipping plain upgrades`);
  console.log(`  Items per hour: ${(total / hours).toFixed(1)} (common ${(counts.common / hours).toFixed(1)}, magic ${(counts.magic / hours).toFixed(1)}, rare ${(counts.rare / hours).toFixed(2)})`);
  console.log(`  Decision drops per hour: ${decisionsPerHour.toFixed(1)} (trigger below ${MIN_DECISION_DROPS_PER_HOUR})`);
  console.log(`  Dominated pairs: ${dominatedShare.toFixed(1)}% of ${pairs} same-Slot rare pairs (trigger above ${MAX_DOMINATED_SHARE}%)`);
  console.log(`  Poison share: ${poisonShare.toFixed(1)}% of rares have Sallow (trigger outside ${POISON_SHARE_RANGE.join('-')}%)`);
  const medianRelit = [...relitAt].sort((a, b) => a - b)[Math.floor(relitAt.length / 2)] ?? 0;
  console.log(`  Lamp relit within ${DROP_HOURS} hours: ${relitAt.length} of ${SEEDS} Seeds, median ${medianRelit.toFixed(0)} minutes`);

  const failures = [];
  if (decisionsPerHour < MIN_DECISION_DROPS_PER_HOUR) failures.push('fewer than 2 decision drops per hour');
  if (dominatedShare > MAX_DOMINATED_SHARE) failures.push('more than 40% dominated pairs');
  if (poisonShare < POISON_SHARE_RANGE[0] || poisonShare > POISON_SHARE_RANGE[1]) failures.push('poison share outside 30-80%');

  console.log('');
  if (failures.length === 0) {
    console.log('R3: PASS. No trigger tripped.');
  } else {
    for (const failure of failures) console.log(`R3: TRIPPED. ${failure}.`);
    process.exitCode = 1;
  }
}

const mode = process.argv[2];
try {
  if (mode === 'builds') measureBuilds();
  else if (mode === 'drops') measureDrops();
  else {
    console.error('Usage: npm run balance -- builds | drops');
    process.exitCode = 2;
  }
} finally {
  await server.close();
}
