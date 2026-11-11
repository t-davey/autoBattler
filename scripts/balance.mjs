// Headless balance measurements. `builds` measures risk R2 and `drops` measures risk R3, both in
// docs/plans/poc-demo/risks.md. `wall` measures the first Wall's targets, `demo-seed` finds Seeds that play the
// demo script, `checkins` plays the Wall on a schedule of check-ins, and `world` plays all 12 Walls of the full-game skeleton. docs/plans/poc-demo-results.md records them. Each exits non-zero if a trigger trips, a target misses, or none is found.
import { createServer } from 'vite';

const SEEDS = Number(process.env.BALANCE_SEEDS ?? 200);
const LEVEL = 7;
const POINTS = LEVEL - 1;
const MAX_RANK = 5;
const POINTS_PER_STEP = 2;
const VIABLE_WITHIN = 10;
const CALIBRATION_STEPS = 12;

/** Each Class's skills in step order, with which are active. */
const CLASSES = {
  'sin-eater': { skills: ['bar-the-way', 'iron-penance', 'shared-burden'], actives: ['bar-the-way'] },
  warrener: { skills: ['bleeders-cut', 'open-veins', 'the-long-cut'], actives: ['bleeders-cut', 'the-long-cut'] },
  lamplighter: { skills: ['mend-by-lamplight', 'warm-hands', 'lantern-ward'], actives: ['mend-by-lamplight', 'lantern-ward'] },
};

/** G25: only this measurement uses them. */
const REFERENCE_RANKS = {
  'sin-eater': [2, 2, 2],
  warrener: [2, 2, 2],
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
const { advance, applyAction, floorAt, LAMPS, beginCatchUp, CATCH_UP_CAP_MS, continueCatchUp, createGame, deserializeGame, partyUnitSpecs, serializeGame, simulateBattle, SLOTS, TICK_MS, viewGame, viewStash } = await server.ssrLoadModule('/src/sim/index.ts');

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

const shroudWith = (sallow) => [{ baseId: 'waxed-shroud', rarity: 'rare', affixes: [{ id: 'sallow', value: sallow }], levelRequirement: 1 }];
const SALLOW_STEP = 2;
const SALLOW_MAX = 70;

/** R2 against the real Guardian, fought through a Run so that nothing about it is a stand-in. Each Hero wears the same shroud. */
function wardenWinRate(sallow, heroId, build) {
  const equipped = { 'sin-eater': shroudWith(sallow), warrener: shroudWith(sallow), lamplighter: shroudWith(sallow) };
  const skillRanks = heroId ? { ...referenceRanks, [heroId]: build.ranks } : referenceRanks;
  let wins = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const game = createGame({ seed, scenario: { heroLevel: LEVEL, skillRanks, equipped, startAt: { floor: 3, room: 'guardian' } } });
    if (heroId) applyAction(game, { type: 'setSkillOrder', heroId, order: build.order });
    let ended = false;
    while (!ended) {
      advance(game, TICK_MS, (event) => {
        if (event.type === 'guardianFell') wins++;
        if (event.type === 'returnedToTown') ended = true;
      });
    }
  }
  return (wins / SEEDS) * 100;
}

function measureBuilds() {
  const standIns = Object.entries(STAND_INS).map(([name, makeEnemies]) => {
    const scale = calibrate(makeEnemies);
    const enemies = makeEnemies(scale);
    const rate = (heroId, build) => winRate(partyWith(heroId, build), enemies);
    return { name, label: `strength ×${scale.toFixed(2)}`, rate, reference: rate(null) };
  });
  // Stand-ins get stronger until the reference Party wins half. The real Guardian stays put, so the Party's gear moves until it wins at least half.
  let sallow = 0;
  while (sallow < SALLOW_MAX && wardenWinRate(sallow, null) < 50) sallow += SALLOW_STEP;
  const warden = (heroId, build) => wardenWinRate(sallow, heroId, build);
  const battles = [...standIns, { name: 'the Mouldering Warden', label: `the real Guardian, each Hero wearing a Waxed Shroud with Sallow ${sallow}`, rate: warden, reference: warden(null) }];

  const results = {};
  for (const heroId of Object.keys(CLASSES)) {
    results[heroId] = buildsFor(heroId).map((build) => ({ ...build, rates: battles.map(({ rate }) => rate(heroId, build)) }));
  }

  console.log(`R2 builds: level ${LEVEL}, ${POINTS} points, ${SEEDS} Seeds per Battle`);
  for (const battle of battles) {
    console.log(`  ${battle.name}: ${battle.label}, reference Party wins ${battle.reference.toFixed(0)}%`);
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

  if (Object.values(bestIn).every((bests) => new Set(bests).size === 1)) {
    failures.push("every Class's best build is the same in every Battle");
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

// Floor 5's Guardian: the Warden's kit at its tuned scale, under a stand-in name since the Undercroft moved to Act 2.
const GUARDIAN_NAME = 'Placeholder Guardian (Act 1, Lamp 1)';
const TICKS_PER_MINUTE = 60_000 / TICK_MS;
const WALL_MINUTES = 120;
const ACT_AT_MINUTE = 60;
const EARLY_WIPE_MINUTES = 5;
/** Weakest first, so the Hero Poison kills soonest gets first pick of the Stash. */
const ANSWER_HERO_ORDER = ['lamplighter', 'warrener', 'sin-eater'];

/** Same Reach only, so no skill is lost. */
const canWear = (hero, item) => {
  const worn = hero.equipment[item.slot];
  return item.levelRequirement <= hero.level && (worn === null || item.reach === worn.reach);
};

/** Reaches the build in step order from the Hero's current ranks, then adds spare points one at a time across the Branch. */
function spendOnBuild(game, heroId, allocation) {
  const { skills } = CLASSES[heroId];
  const spend = (skillId) => applyAction(game, { type: 'spendSkillPoint', heroId, skillId }).ok;
  const hero = viewGame(game).heroes.find(({ id }) => id === heroId);
  skills.forEach((skillId, index) => {
    const current = hero.skills.find(({ id }) => id === skillId).rank;
    for (let rank = current; rank < allocation[index]; rank++) spend(skillId);
  });
  for (let spent = true; spent; ) {
    spent = false;
    for (const skillId of skills) if (spend(skillId)) spent = true;
  }
}

function spendReferencePoints(game, builds = REFERENCE_RANKS) {
  for (const heroId of Object.keys(CLASSES)) if (builds[heroId]) spendOnBuild(game, heroId, builds[heroId]);
}

/** For each Hero and Slot, the Stash's highest poison resistance above what's worn. */
function equipPoisonAnswer(game) {
  for (const heroId of ANSWER_HERO_ORDER) {
    for (const slot of SLOTS) {
      const hero = viewGame(game).heroes.find(({ id }) => id === heroId);
      const worn = hero.equipment[slot];
      const wearable = viewStash(game).filter((item) => item.slot === slot && canWear(hero, item));
      const best = wearable.reduce((top, item) => (top === null || item.stats.poisonResistance > top.stats.poisonResistance ? item : top), null);
      if (best && best.stats.poisonResistance > (worn?.stats.poisonResistance ?? 0)) {
        applyAction(game, { type: 'equipItem', heroId, itemId: best.id });
      }
    }
  }
}

/** For each Hero and Slot, the Stash's highest score above what's worn. */
function equipBestBy(game, score) {
  for (const heroId of ANSWER_HERO_ORDER) {
    for (const slot of SLOTS) {
      const hero = viewGame(game).heroes.find(({ id }) => id === heroId);
      const worn = hero.equipment[slot];
      const wearable = viewStash(game).filter((item) => item.slot === slot && canWear(hero, item));
      const best = wearable.reduce((top, item) => (top === null || score(item.stats) > score(top.stats) ? item : top), null);
      if (best && score(best.stats) > (worn ? score(worn.stats) : 0)) applyAction(game, { type: 'equipItem', heroId, itemId: best.id });
    }
  }
}

const toughness = (stats) => stats.armour + stats.maxHealth / 3;
/** A player reading both Phases: poison resistance for the first, armour and health for the second. */
const bothPhases = (stats) => stats.poisonResistance * 2 + toughness(stats);

const newLedger = () => ({
  battleTicks: [],
  floorTicks: [],
  floorStart: 0,
  battleStart: 0,
  fightingGuardian: false,
  damage: {},
  firstAttempt: null,
  firstKill: null,
  kills: 0,
  firstRare: null,
  earlyWipes: 0,
  wipesByFloor: {},
  guardianWipes: 0,
  guardianPoisonWipes: 0,
  level: 0,
});

function recordEvent(ledger, tick, event) {
  switch (event.type) {
    case 'battleStarted':
      ledger.battleStart = tick;
      ledger.fightingGuardian = event.enemyNames[0] === GUARDIAN_NAME;
      ledger.damage = {};
      return;
    case 'battleEnded':
      if (!ledger.fightingGuardian) ledger.battleTicks.push(tick - ledger.battleStart);
      return;
    case 'attack':
    case 'effectDamage':
      if (Object.hasOwn(CLASSES, event.targetId)) ledger.damage[event.damageType] = (ledger.damage[event.damageType] ?? 0) + event.damage + event.absorbed;
      return;
    case 'floorEntered':
      if (event.floor > 1) ledger.floorTicks.push(tick - ledger.floorStart);
      ledger.floorStart = tick;
      return;
    case 'roomEntered':
      if (event.kind !== 'guardian') return;
      // Floor 3 has no stairs down: reaching the Guardian finishes it.
      ledger.floorTicks.push(tick - ledger.floorStart);
      ledger.firstAttempt ??= tick;
      return;
    case 'wipe':
      ledger.wipesByFloor[event.floor] = (ledger.wipesByFloor[event.floor] ?? 0) + 1;
      if (tick <= EARLY_WIPE_MINUTES * TICKS_PER_MINUTE) ledger.earlyWipes++;
      if (event.enemyName === GUARDIAN_NAME) {
        ledger.guardianWipes++;
        if ((ledger.damage.poison ?? 0) > (ledger.damage.physical ?? 0)) ledger.guardianPoisonWipes++;
      }
      return;
    case 'guardianFell':
      ledger.kills++;
      ledger.firstKill ??= tick;
      return;
    case 'itemFound':
      if (event.item.rarity === 'rare') ledger.firstRare ??= tick;
      return;
    default:
      return;
  }
}

/** Runs a Game forward, Tick by Tick, into its ledger. */
function playTo(game, ledger, endTick) {
  for (let tick = viewGame(game).tick; tick < endTick; tick++) {
    advance(game, TICK_MS, (event) => recordEvent(ledger, tick + 1, event));
  }
}

const answerWith = (builds) => (game) => {
  spendReferencePoints(game, { ...REFERENCE_RANKS, ...builds });
  equipPoisonAnswer(game);
};

/** The plan's 3 scripted players. */
const WALL_PLAYERS = {
  Untended: () => {},
  'Points only': (game) => spendReferencePoints(game),
  Answer: answerWith({}),
};

/** The Answer with one thing changed, for the M2 review's Watch list and G27's Warm Hands comparison. */
const WALL_VARIANTS = {
  'Gear only': equipPoisonAnswer,
  // A build that skips The Long Cut, with no gear, to test whether points alone can beat the Wall.
  'Points only, every Hero 5/1/0': (game) => spendReferencePoints(game, { 'sin-eater': [5, 1, 0], warrener: [5, 1, 0], lamplighter: [5, 1, 0] }),
  'Points only, Warrener 5/1/0': (game) => spendReferencePoints(game, { ...REFERENCE_RANKS, warrener: [5, 1, 0] }),
  'Answer, Sin-Eater spends nothing': answerWith({ 'sin-eater': null }),
  'Answer, Warrener spends nothing': answerWith({ warrener: null }),
  'Answer, Lamplighter spends nothing': answerWith({ lamplighter: null }),
  'Answer, Lamplighter 2/2/2 (Warm Hands)': answerWith({ lamplighter: [2, 2, 2] }),
  'Answer, Warrener 5/1/0 (no Long Cut)': answerWith({ warrener: [5, 1, 0] }),
};

const medianOf = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? null;
const sum = (values) => values.reduce((total, value) => total + value, 0);
const ticksToMinutes = (ticks) => ticks / TICKS_PER_MINUTE;
const killShare = (ledgers) => (ledgers.filter(({ firstKill }) => firstKill !== null).length / ledgers.length) * 100;
const medianKill = (ledgers) => medianOf(ledgers.flatMap(({ firstKill }) => (firstKill === null ? [] : [ticksToMinutes(firstKill)])));

/** Plays each Seed to the hour once, then forks that same hour into every player. */
function runWall(players, firstSeed) {
  const results = Object.fromEntries(Object.keys(players).map((name) => [name, []]));
  for (let seed = firstSeed; seed < firstSeed + SEEDS; seed++) {
    const shared = createGame({ seed });
    const sharedLedger = newLedger();
    playTo(shared, sharedLedger, ACT_AT_MINUTE * TICKS_PER_MINUTE);
    const saved = serializeGame(shared);
    for (const [name, act] of Object.entries(players)) {
      const game = deserializeGame(saved);
      const ledger = structuredClone(sharedLedger);
      act(game);
      playTo(game, ledger, WALL_MINUTES * TICKS_PER_MINUTE);
      ledger.level = viewGame(game).heroes[0].level;
      results[name].push(ledger);
    }
  }
  return results;
}

const formatted = (value, unit = '') => (value === null ? 'none' : `${value.toFixed(1)}${unit}`);
const within = (value, low, high) => value !== null && value >= low && value <= high;

function printPlayers(results) {
  console.log(`\n  ${'player'.padEnd(42)}${'killed'.padEnd(8)}${'median kill'.padEnd(13)}${'kills/Seed'.padEnd(12)}${'Wipes/Seed, Floors 1-5'.padEnd(26)}${'at Guardian'.padEnd(13)}level`);
  for (const [name, ledgers] of Object.entries(results)) {
    const wipes = [1, 2, 3, 4, 5].map((floor) => (sum(ledgers.map(({ wipesByFloor }) => wipesByFloor[floor] ?? 0)) / SEEDS).toFixed(1)).join(' / ');
    const atGuardian = (sum(ledgers.map(({ guardianWipes }) => guardianWipes)) / SEEDS).toFixed(1);
    const median = medianKill(ledgers);
    const kills = (sum(ledgers.map(({ kills: count }) => count)) / SEEDS).toFixed(1);
    console.log(`  ${name.padEnd(42)}${`${killShare(ledgers).toFixed(0)}%`.padEnd(8)}${(median === null ? '-' : `${median.toFixed(0)} min`).padEnd(13)}${kills.padEnd(12)}${wipes.padEnd(26)}${atGuardian.padEnd(13)}${medianOf(ledgers.map(({ level }) => level))}`);
  }
}

/** A later firstSeed checks that tuning holds on Seeds it never saw. */
function measureWall(firstSeed) {
  const results = runWall({ ...WALL_PLAYERS, ...WALL_VARIANTS }, firstSeed);
  const { Untended: untended, 'Points only': pointsOnly, Answer: answer } = results;

  const battleSeconds = (medianOf(untended.flatMap(({ battleTicks }) => battleTicks)) * TICK_MS) / 1000;
  const floorMinutes = ticksToMinutes(medianOf(untended.flatMap(({ floorTicks }) => floorTicks)));
  const attempts = untended.flatMap(({ firstAttempt }) => (firstAttempt === null ? [] : [ticksToMinutes(firstAttempt)]));
  const earlyWipes = (untended.filter(({ earlyWipes: count }) => count > 0).length / SEEDS) * 100;
  const rares = (untended.filter(({ firstRare }) => firstRare !== null && ticksToMinutes(firstRare) <= ACT_AT_MINUTE).length / SEEDS) * 100;
  const scripted = [untended, pointsOnly, answer].flat();
  const guardianWipes = sum(scripted.map(({ guardianWipes: count }) => count));
  const poisonWipes = guardianWipes === 0 ? 0 : (sum(scripted.map(({ guardianPoisonWipes }) => guardianPoisonWipes)) / guardianWipes) * 100;
  const answerKills = killShare(answer);
  const gap = answerKills - killShare(pointsOnly);

  const targets = [
    ['Median Battle length, Floors 1-5', '20-30 s', formatted(battleSeconds, ' s'), within(battleSeconds, 20, 30)],
    ['Median Floor length', '4-6 min', formatted(floorMinutes, ' min'), within(floorMinutes, 4, 6)],
    ['First Guardian attempt, median', '50-80 min', `${formatted(medianOf(attempts), ' min')}, reached in ${attempts.length} of ${SEEDS} Seeds`, within(medianOf(attempts), 50, 80)],
    ['New Party Wipes in first 5 minutes', 'under 5%', formatted(earlyWipes, '%'), earlyWipes < 5],
    ['At least one rare by 60 minutes', 'at least 80%', formatted(rares, '%'), rares >= 80],
    ['Guardian Wipes mainly poison', 'at least 90%', `${formatted(poisonWipes, '%')} of ${guardianWipes}`, poisonWipes >= 90],
    ['Untended: Guardian killed in 2 hours', 'at most 10%', formatted(killShare(untended), '%'), killShare(untended) <= 10],
  ];

  console.log(`Wall: ${WALL_MINUTES} minutes of Party time over ${SEEDS} Seeds from ${firstSeed}, acting at minute ${ACT_AT_MINUTE}.`);
  console.log('Pacing rows read the Untended player, whose first hour every player shares.\n');
  for (const [name, target, value, passed] of targets) {
    console.log(`  ${passed ? 'PASS' : 'MISS'}  ${name.padEnd(40)}${target.padEnd(20)}${value}`);
  }
  printPlayers(results);

  const misses = targets.filter(([, , , passed]) => !passed);
  console.log('');
  if (misses.length === 0) {
    console.log('Wall: PASS. Every target met.');
  } else {
    console.log(`Wall: MISSED ${misses.length} of ${targets.length} targets.`);
    process.exitCode = 1;
  }
}

const DEMO_SEEDS_TRIED = 500;
const CHUNK_TICKS = 5_000;
/** How long a rehearser might watch before skipping an hour. A demo Seed has to hold for each. */
const WATCH_MINUTES = [0, 1, 2, 3, 5];
const HOUR_MS = 3_600_000;

/** Plays the watching, then an hour of catch-up, as "Skip 1 hour" does. */
function skipAnHour(seed, watchMinutes) {
  const game = createGame({ seed });
  advance(game, watchMinutes * 60_000);
  const running = beginCatchUp(game, HOUR_MS);
  let report = null;
  while (report === null) report = continueCatchUp(game, running, CHUNK_TICKS);
  return { game, report };
}

/** The usable rare with the most poison resistance, and the Hero who'd wear it, or null. */
function usableSallowRare(game) {
  const { heroes } = viewGame(game);
  const rares = viewStash(game)
    .filter((item) => item.rarity === 'rare' && item.affixes.includes('sallow'))
    .sort((a, b) => b.stats.poisonResistance - a.stats.poisonResistance);
  for (const item of rares) {
    for (const heroId of ANSWER_HERO_ORDER) {
      const hero = heroes.find(({ id }) => id === heroId);
      if (canWear(hero, item)) return { item, heroId };
    }
  }
  return null;
}

/** The first Guardian kill within an hour of Party time, in minutes, or null. */
function minutesToKill(game) {
  let found = null;
  for (let tick = 0; tick < 60 * TICKS_PER_MINUTE && found === null; tick++) {
    advance(game, TICK_MS, (event) => {
      if (event.type === 'guardianFell') found ??= ticksToMinutes(tick);
    });
  }
  return found;
}

/** Whether a Seed plays the demo script, whichever way the rehearser takes it. */
function tryDemoSeed(seed) {
  const kills = [];
  let wipes = 0;
  let rareName = '';
  for (const watch of WATCH_MINUTES) {
    const { game, report } = skipAnHour(seed, watch);
    const poisoned = report.setbacks.filter((setback) => setback.kind === 'wipe' && setback.enemyName === GUARDIAN_NAME && setback.mainDamageType === 'poison' && setback.mainDamageShare > 0.5);
    const rare = usableSallowRare(game);
    if (poisoned.length === 0 || report.guardianKills > 0 || !rare) return null;
    wipes = poisoned.length;
    rareName = rare.item.name;

    const saved = serializeGame(game);
    if (minutesToKill(deserializeGame(saved)) !== null) return null; // It has to need the player.

    const pointsAndRare = deserializeGame(saved);
    spendReferencePoints(pointsAndRare);
    applyAction(pointsAndRare, { type: 'equipItem', heroId: rare.heroId, itemId: rare.item.id });
    const kill = minutesToKill(pointsAndRare);
    if (kill === null) return null;
    kills.push(kill);
  }
  return { seed, wipes, rareName, kills };
}

/** Lowest Seed first among those that hold however long the rehearser watches. */
function searchDemoSeed(firstSeed) {
  const found = [];
  for (let seed = firstSeed; seed < firstSeed + DEMO_SEEDS_TRIED; seed++) {
    const result = tryDemoSeed(seed);
    if (result) found.push(result);
  }
  console.log(`Demo Seed: ${found.length} of ${DEMO_SEEDS_TRIED} Seeds from ${firstSeed} hold for a watch of ${WATCH_MINUTES.join(', ')} minutes.`);
  for (const { seed, wipes, rareName, kills } of found.slice(0, 15)) {
    console.log(`  Seed ${String(seed).padEnd(6)}${String(wipes).padEnd(3)}Guardian Wipes, then kills after ${kills.map((kill) => kill.toFixed(0)).join('/').padEnd(16)} min. Last rare: ${rareName}`);
  }
  if (found.length === 0) process.exitCode = 1;
}

const CHECK_IN_GAPS_HOURS = [4, 8, 12];
const TUNED_GAP_HOURS = 8;
const CHECK_INS = 3;
const UNTENDED_HOURS = 24;
const PATIENT_HOURS = 72;
const FULL_ABSENCE_HOURS = CATCH_UP_CAP_MS / HOUR_MS;
const TICKS_PER_HOUR = 60 * TICKS_PER_MINUTE;

/** Plays until endTick or the first Guardian kill, adding to the record. */
function playToKill(game, record, endTick) {
  for (let tick = viewGame(game).tick; tick < endTick && record.killTick === null; tick++) {
    advance(game, TICK_MS, (event) => {
      if (event.type === 'guardianFell') {
        record.killTick = tick + 1;
        record.killLevel = viewGame(game).heroes[0].level;
      } else if (event.type === 'phaseChanged' && event.unitName === GUARDIAN_NAME) {
        record.secondPhaseTick ??= tick + 1;
      } else if ((event.type === 'wipe' || event.type === 'draw') && event.enemyName === GUARDIAN_NAME) {
        record.guardianSetbacks++;
      }
    });
  }
}

const newCheckInRecord = (guardianSetbacks = 0, secondPhaseTick = null) => ({ checkIns: 0, killTick: null, killLevel: null, guardianSetbacks, secondPhaseTick });

/** Each acts at every check-in, on all the points and Stash they have by then. */
const CHECK_IN_PLAYERS = {
  Routine: (game) => {
    spendPoints(game);
    for (const item of viewStash(game)) equipUpgrade(game, item);
  },
  Answer: (game) => {
    spendReferencePoints(game);
    equipBestBy(game, bothPhases);
  },
  'Poison only': WALL_PLAYERS.Answer,
  'Armour only': (game) => {
    spendReferencePoints(game);
    equipBestBy(game, toughness);
  },
};

/** One tended player, from the end of the first absence that every player shares. */
function playCheckIns(saved, setbacks, secondPhaseTick, act, gapHours) {
  const game = deserializeGame(saved);
  const record = newCheckInRecord(setbacks, secondPhaseTick);
  for (let checkIns = 1; checkIns <= CHECK_INS && record.killTick === null; checkIns++) {
    record.checkIns = checkIns;
    act(game);
    playToKill(game, record, (checkIns + 1) * gapHours * TICKS_PER_HOUR);
  }
  return record;
}

function runCheckIns(firstSeed) {
  const results = { untended: [], tended: {} };
  for (const gapHours of CHECK_IN_GAPS_HOURS) {
    results.tended[gapHours] = Object.fromEntries(Object.keys(CHECK_IN_PLAYERS).map((name) => [name, []]));
  }
  const stops = [...new Set([...CHECK_IN_GAPS_HOURS, FULL_ABSENCE_HOURS, UNTENDED_HOURS, PATIENT_HOURS])].sort((a, b) => a - b);
  for (let seed = firstSeed; seed < firstSeed + SEEDS; seed++) {
    const game = createGame({ seed });
    const untended = { ...newCheckInRecord(), levels: {} };
    for (const hours of stops) {
      playToKill(game, untended, hours * TICKS_PER_HOUR);
      // A kill ends the record, not the Party, so each hour's level still reads true.
      for (let tick = viewGame(game).tick; tick < hours * TICKS_PER_HOUR; tick++) advance(game, TICK_MS);
      untended.levels[hours] = viewGame(game).heroes[0].level;
      if (!CHECK_IN_GAPS_HOURS.includes(hours)) continue;
      for (const [name, act] of Object.entries(CHECK_IN_PLAYERS)) {
        const record = untended.killTick !== null ? { ...untended } : playCheckIns(serializeGame(game), untended.guardianSetbacks, untended.secondPhaseTick, act, hours);
        results.tended[hours][name].push(record);
      }
    }
    results.untended.push(untended);
  }
  return results;
}

/** The share of Seeds whose first kill came after exactly this many check-ins. */
const killedAfter = (records, checkIns) => (records.filter((record) => record.killTick !== null && record.checkIns === checkIns).length / records.length) * 100;
const percent = (value) => `${value.toFixed(0)}%`;

function printCheckIns(gapHours, name, records) {
  const buckets = Array.from({ length: CHECK_INS + 1 }, (_, checkIns) => percent(killedAfter(records, checkIns)).padEnd(8));
  const killed = records.filter(({ killTick }) => killTick !== null);
  const never = percent(((records.length - killed.length) / records.length) * 100);
  const hours = killed.length === 0 ? '-' : `${(medianOf(killed.map(({ killTick }) => killTick)) / TICKS_PER_HOUR).toFixed(1)} h`;
  const level = killed.length === 0 ? '-' : String(medianOf(killed.map(({ killLevel }) => killLevel)));
  const setbacks = (sum(records.map(({ guardianSetbacks }) => guardianSetbacks)) / records.length).toFixed(1);
  console.log(`  ${`${gapHours} h`.padEnd(6)}${name.padEnd(10)}${buckets.join('')}${never.padEnd(8)}${hours.padEnd(10)}${level.padEnd(8)}${setbacks}`);
}

/** G40: a Wall takes 2-3 check-ins, and levels alone don't beat it within a full absence. */
function measureCheckIns(firstSeed) {
  const { untended, tended } = runCheckIns(firstSeed);
  const killedBy = (hours) => (untended.filter(({ killTick }) => killTick !== null && killTick <= hours * TICKS_PER_HOUR).length / untended.length) * 100;
  const levels = [...CHECK_IN_GAPS_HOURS, UNTENDED_HOURS].map((hours) => `${hours} h: ${medianOf(untended.map((record) => record.levels[hours]))}`);

  console.log(`Check-ins: ${SEEDS} Seeds from ${firstSeed}. Each player acts at up to ${CHECK_INS} check-ins, and the last gets a full gap to play out.\n`);
  console.log(`  Untended: killed by ${FULL_ABSENCE_HOURS} h ${percent(killedBy(FULL_ABSENCE_HOURS))}, by ${UNTENDED_HOURS} h ${percent(killedBy(UNTENDED_HOURS))}, by ${PATIENT_HOURS} h ${percent(killedBy(PATIENT_HOURS))}. Median level at ${levels.join(', ')}.\n`);
  console.log(`  ${''.padEnd(16)}First kill, by check-ins made`);
  console.log(`  ${'gap'.padEnd(6)}${'player'.padEnd(10)}${['0', '1', '2', '3', 'none'].map((label) => label.padEnd(8)).join('')}${'median'.padEnd(10)}${'level'.padEnd(8)}Guardian Setbacks`);
  for (const gapHours of CHECK_IN_GAPS_HOURS) {
    for (const [name, records] of Object.entries(tended[gapHours])) printCheckIns(gapHours, name, records);
  }

  const answer = tended[TUNED_GAP_HOURS].Answer;
  const answerInTime = killedAfter(answer, 2) + killedAfter(answer, 3);
  const killedAtAll = (records) => (records.filter(({ killTick }) => killTick !== null).length / records.length) * 100;
  const reachedInTime = (answer.filter(({ secondPhaseTick }) => secondPhaseTick !== null && secondPhaseTick <= 2 * TUNED_GAP_HOURS * TICKS_PER_HOUR).length / answer.length) * 100;
  const oneAnswerGap = killedAtAll(answer) - Math.max(killedAtAll(tended[TUNED_GAP_HOURS]['Poison only']), killedAtAll(tended[TUNED_GAP_HOURS]['Armour only']));
  const targets = [
    ['Answer: Phase 2 reached by the 2nd check-in', 'at least 80%', percent(reachedInTime), reachedInTime >= 80],
    ['One answer only: kills below Answer', 'at least 20 points', `${oneAnswerGap.toFixed(0)} points`, oneAnswerGap >= 20],
    [`Untended: killed by ${FULL_ABSENCE_HOURS} h`, 'at most 10%', percent(killedBy(FULL_ABSENCE_HOURS)), killedBy(FULL_ABSENCE_HOURS) <= 10],
    [`Answer, ${TUNED_GAP_HOURS} h gap: first kill after 2-3 check-ins`, 'at least 80%', percent(answerInTime), answerInTime >= 80],
  ];
  console.log('');
  for (const [name, target, value, passed] of targets) {
    console.log(`  ${passed ? 'PASS' : 'MISS'}  ${name.padEnd(48)}${target.padEnd(16)}${value}`);
  }
  const misses = targets.filter(([, , , passed]) => !passed);
  console.log('');
  if (misses.length === 0) {
    console.log('Check-ins: PASS. Every target met.');
  } else {
    console.log(`Check-ins: MISSED ${misses.length} of ${targets.length} targets.`);
    process.exitCode = 1;
  }
}

const WORLD_SEEDS = Number(process.env.WORLD_SEEDS ?? 10);
const WORLD_HOURS = 48;
const WORLD_GAP_HOURS = 3;
/** The design's weekend pace: about 3 hours of Party time per Wall, 30-40 for the first Difficulty Tier. */
const WALL_HOURS_TARGET = [2, 4];
const TIER_HOURS_TARGET = [30, 40];
const RUN_MINUTES_TARGET = [15, 30];

/** Plays the whole world with the Routine player checking in every few hours, and records each Lamp's first relight. */
function playWorld(seed) {
  const game = createGame({ seed });
  const relitAt = [];
  let deepest = 1;
  let wipes = 0;
  const runs = [];
  let sentAt = 0;
  /** Attempts at the frontier Guardian, with the Picks each Run held. */
  const attempts = [];
  let picks = [];
  let attempting = null;
  for (let hour = 0; hour < WORLD_HOURS; hour += WORLD_GAP_HOURS) {
    CHECK_IN_PLAYERS.Routine(game);
    for (let step = 0; step < WORLD_GAP_HOURS * 60; step++) {
      advance(game, 60_000, (event) => {
        if (event.type === 'pickTaken') picks.push(event.taken.id);
        else if (event.type === 'roomEntered' && event.kind === 'guardian') {
          const lamp = event.floor / 5 - 1;
          attempting = lamp === relitAt.length ? { lamp } : null;
        } else if (attempting && (event.type === 'lampRelit' || event.type === 'wipe' || event.type === 'draw')) {
          attempts.push({ ...attempting, won: event.type === 'lampRelit', picks: [...picks] });
          attempting = null;
        }
        if (event.type === 'returnedToTown') picks = [];
        if (event.type === 'lampRelit') relitAt.push({ hours: viewGame(game).tick / TICKS_PER_HOUR, level: viewGame(game).heroes[0].level });
        else if (event.type === 'floorEntered') deepest = Math.max(deepest, event.floor);
        else if (event.type === 'wipe') wipes++;
        else if (event.type === 'partySent') sentAt = viewGame(game).tick;
        else if (event.type === 'returnedToTown') runs.push({ minutes: (viewGame(game).tick - sentAt) / (TICKS_PER_HOUR / 60), reason: event.reason });
      });
    }
  }
  return { relitAt, deepest, wipes, runs, attempts, level: viewGame(game).heroes[0].level };
}

/**
 * Whether Walls fall to good Runs: tries per first kill, and the frontier Guardian win rate by each Pick held.
 * A Pick that lifts the rate well above the rest makes Runs differ; a Wall that falls on the first try isn't one.
 */
function reportPicks(attempts) {
  const rate = (list) => (list.length === 0 ? 'none' : `${((list.filter((attempt) => attempt.won).length / list.length) * 100).toFixed(0)}% of ${list.length}`);
  const tries = LAMPS.map((_, lamp) => {
    const bySeed = [];
    let count = 0;
    for (const attempt of attempts.filter((candidate) => candidate.lamp === lamp)) {
      count++;
      if (attempt.won) {
        bySeed.push(count);
        count = 0;
      }
    }
    return medianOf(bySeed);
  });
  console.log(`
  Guardian tries to the first kill, median per Lamp: ${tries.map((count) => count ?? '-').join(', ')}.`);
  console.log(`  Frontier Guardian wins: ${rate(attempts)}. By Pick held:`);
  for (const id of [...new Set(attempts.flatMap((attempt) => attempt.picks))].sort()) {
    console.log(`    ${id.padEnd(16)}with ${rate(attempts.filter((attempt) => attempt.picks.includes(id))).padEnd(14)}without ${rate(attempts.filter((attempt) => !attempt.picks.includes(id)))}`);
  }
}

function measureWorld(firstSeed) {
  console.log(`World: ${WORLD_HOURS} hours of Party time over ${WORLD_SEEDS} Seeds from ${firstSeed}, Routine player checking in every ${WORLD_GAP_HOURS} h.`);
  console.log(`Target: each Wall takes ${WALL_HOURS_TARGET[0]}-${WALL_HOURS_TARGET[1]} h of Party time, the Tier ${TIER_HOURS_TARGET[0]}-${TIER_HOURS_TARGET[1]} h.
`);
  const runs = Array.from({ length: WORLD_SEEDS }, (_, index) => playWorld(firstSeed + index));
  console.log(`  ${'Lamp'.padEnd(26)}${'relit in'.padEnd(10)}${'median h'.padEnd(10)}${'h since last'.padEnd(14)}${'level'.padEnd(7)}verdict`);
  let previous = 0;
  let misses = 0;
  LAMPS.forEach((lamp, index) => {
    const relit = runs.flatMap(({ relitAt }) => (relitAt[index] ? [relitAt[index]] : []));
    const hours = medianOf(relit.map((entry) => entry.hours));
    const gap = hours === null ? null : hours - previous;
    const verdict = gap === null ? 'STALL' : within(gap, ...WALL_HOURS_TARGET) ? 'PASS' : gap < WALL_HOURS_TARGET[0] ? 'FAST' : 'SLOW';
    if (verdict !== 'PASS') misses++;
    const { act, floor } = floorAt(lamp.depth);
    const name = `Act ${act}, Floor ${floor}${lamp.placeholder ? '' : ' (built)'}`;
    console.log(`  ${name.padEnd(26)}${`${relit.length}/${runs.length}`.padEnd(10)}${formatted(hours).padEnd(10)}${formatted(gap).padEnd(14)}${String(medianOf(relit.map((entry) => entry.level)) ?? '-').padEnd(7)}${verdict}`);
    if (hours !== null) previous = hours;
  });
  const deepest = medianOf(runs.map((run) => run.deepest));
  const { act, floor } = floorAt(deepest);
  console.log(`
  Median deepest Floor: Act ${act}, Floor ${floor}. Median level at the end: ${medianOf(runs.map((run) => run.level))}. Median Wipes: ${medianOf(runs.map((run) => run.wipes))}.`);
  reportPicks(runs.flatMap((run) => run.attempts));
  const allRuns = runs.flatMap((run) => run.runs);
  const runMinutes = allRuns.map((run) => run.minutes).sort((a, b) => a - b);
  const percentile = (share) => runMinutes[Math.floor(share * (runMinutes.length - 1))] ?? null;
  const runShare = (test) => `${((allRuns.filter(test).length / allRuns.length) * 100).toFixed(0)}%`;
  const reasons = [...new Set(allRuns.map((run) => run.reason))].map((reason) => `${reason} ${runShare((run) => run.reason === reason)}`).join(', ');
  console.log(`  Runs: ${allRuns.length}, minutes at the 10th/50th/90th percentile ${formatted(percentile(0.1))}/${formatted(percentile(0.5))}/${formatted(percentile(0.9))}, ${runShare((run) => run.minutes >= RUN_MINUTES_TARGET[0] && run.minutes <= RUN_MINUTES_TARGET[1])} within ${RUN_MINUTES_TARGET[0]}-${RUN_MINUTES_TARGET[1]}. Ended by ${reasons}.`);
  const tierHours = medianOf(runs.map(({ relitAt }) => (relitAt.length === LAMPS.length ? relitAt.at(-1).hours : Infinity)));
  const tierOnPace = tierHours !== null && within(tierHours, ...TIER_HOURS_TARGET);
  console.log(`  Tier finished: ${runs.filter(({ relitAt }) => relitAt.length === LAMPS.length).length}/${runs.length} Seeds, median ${formatted(tierHours)} h${tierOnPace ? '' : ', off target'}.`);
  console.log(`World: ${misses} of ${LAMPS.length} Walls off the target pace.`);
  if (misses > 0 || !tierOnPace) process.exitCode = 1;
}

const mode = process.argv[2];
const firstSeed = Number(process.argv[3] ?? 1);
try {
  if (mode === 'builds') measureBuilds();
  else if (mode === 'drops') measureDrops();
  else if (mode === 'wall') measureWall(firstSeed);
  else if (mode === 'demo-seed') searchDemoSeed(firstSeed);
  else if (mode === 'checkins') measureCheckIns(firstSeed);
  else if (mode === 'world') measureWorld(firstSeed);
  else {
    console.error('Usage: npm run balance -- builds | drops | wall [firstSeed] | demo-seed [firstSeed] | checkins [firstSeed] | world [firstSeed]');
    process.exitCode = 2;
  }
} finally {
  await server.close();
}
