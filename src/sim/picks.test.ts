import { describe, expect, it } from 'vitest';
import {
  advance,
  applyAction,
  beginCatchUp,
  continueCatchUp,
  createGame,
  DEFAULT_PICK_PRIORITY,
  deserializeGame,
  OFFERS_PER_PICK,
  partyUnitSpecs,
  PICK_TAGS,
  PICKS,
  serializeGame,
  TICK_MS,
  viewGame,
  type Game,
  type GameEvent,
  type GameSetup,
  type PickId,
  type PickTag,
  type UnitSpec,
} from './index';

type Scenario = NonNullable<GameSetup['scenario']>;
type PickEvent = Extract<GameEvent, { type: 'pickTaken' }>;

function stepUntil(game: Game, wanted: (event: GameEvent) => boolean, seen: GameEvent[] = []): GameEvent {
  for (let i = 0; i < 400_000; i++) {
    let found: GameEvent | undefined;
    advance(game, TICK_MS, (event) => {
      seen.push(event);
      if (!found && wanted(event)) found = event;
    });
    if (found) return found;
  }
  throw new Error('the wanted event never came');
}

const isType = <T extends GameEvent['type']>(type: T) => (event: GameEvent): event is Extract<GameEvent, { type: T }> => event.type === type;
const atGuardian: Scenario = { startAt: { floor: 5, room: 'guardian' } };

/** The first Pick of each Seed's Game. */
function firstPicks(scenario: Scenario, seeds = 40): PickEvent[] {
  return Array.from({ length: seeds }, (_, seed) => stepUntil(createGame({ seed, scenario }), isType('pickTaken')) as PickEvent);
}

/** The Party's Battle Units in the current Battle, or the next to start, read from the save. */
function partyUnits(game: Game): UnitSpec[] {
  if (!viewGame(game).battle) stepUntil(game, isType('battleStarted'));
  const saved = JSON.parse(serializeGame(game)) as { game: { battle: { units: { team: string; spec: UnitSpec }[] } } };
  return saved.game.battle.units.filter((unit) => unit.team === 'a').map((unit) => unit.spec);
}

const rankOf = (id: PickId) => Math.min(...PICKS[id].tags.map((tag) => DEFAULT_PICK_PRIORITY.indexOf(tag)));

describe('Picks', () => {
  it('a Run sets out with a Pick of 3 Boons or Stacking offers, before its first Battle', () => {
    const seen: GameEvent[] = [];
    const game = createGame({ seed: 1 });
    stepUntil(game, isType('battleStarted'), seen);
    const types = seen.map((event) => event.type);
    expect(types.indexOf('pickTaken')).toBeLessThan(types.indexOf('battleStarted'));
    for (const pick of firstPicks({})) {
      expect(pick.moment).toBe('setOut');
      expect(new Set(pick.offers.map((offer) => offer.id)).size).toBe(OFFERS_PER_PICK);
      expect(pick.offers.every((offer) => ['boon', 'stacking'].includes(PICKS[offer.id].kind))).toBe(true);
      expect(pick.offers).toContainEqual(pick.taken);
    }
  });

  it('reaching a Guardian offers a Pick that can hold Wall prep', () => {
    const picks = firstPicks(atGuardian);
    expect(picks.every((pick) => pick.moment === 'guardian')).toBe(true);
    expect(picks.every((pick) => pick.offers.every((offer) => PICKS[offer.id].kind !== 'stacking'))).toBe(true);
    expect(picks.some((pick) => pick.offers.some((offer) => PICKS[offer.id].kind === 'wallPrep'))).toBe(true);
  });

  it('the default rule takes the offer whose best tag it ranks highest', () => {
    for (const pick of [...firstPicks({}), ...firstPicks(atGuardian)]) {
      const best = Math.min(...pick.offers.map((offer) => rankOf(offer.id)));
      expect(rankOf(pick.taken.id)).toBe(best);
    }
  });

  it('the view lists what the Run has taken, and Town clears it', () => {
    const game = createGame({ seed: 3, scenario: { heroLevel: 40 } });
    const taken = stepUntil(game, isType('pickTaken')) as PickEvent;
    expect(viewGame(game).picks).toEqual([taken.taken]);
    expect(taken.taken.placeholder).toBe(true);
    stepUntil(game, isType('returnedToTown'));
    expect(viewGame(game).picks).toEqual([]);
  });

  it('the same Seed offers the same Picks, and a save keeps them mid-Run', () => {
    const offersOf = (game: Game) => (stepUntil(game, isType('pickTaken')) as PickEvent).offers;
    expect(offersOf(createGame({ seed: 9 }))).toEqual(offersOf(createGame({ seed: 9 })));
    const game = createGame({ seed: 9 });
    stepUntil(game, isType('pickTaken'));
    const loaded = deserializeGame(serializeGame(game))!;
    expect(viewGame(loaded).picks).toEqual(viewGame(game).picks);
  });

  it('a taken Pick changes the Party’s Battle Units', () => {
    const effectOf = (id: PickId, scenario: Scenario) => {
      for (let seed = 0; seed < 200; seed++) {
        const game = createGame({ seed, scenario });
        const pick = stepUntil(game, isType('pickTaken')) as PickEvent;
        // The Heroes' own Units, before Picks.
        if (pick.taken.id === id) return { picked: partyUnits(game), base: partyUnitSpecs(game) };
      }
      throw new Error(`no Seed took ${id}`);
    };
    const poison = effectOf('prep-poison', atGuardian);
    poison.picked.forEach((unit, index) => expect(unit.resistances.poison).toBe((poison.base[index]!.resistances.poison ?? 0) + 30));
    const guardian = effectOf('prep-guardian', atGuardian);
    guardian.picked.forEach((unit, index) => expect(unit.power).toBeCloseTo(guardian.base[index]!.power * 1.25));
  });

  it('Stacking power grows with each Floor the Run clears', () => {
    for (let seed = 0; seed < 200; seed++) {
      const game = createGame({ seed, scenario: { heroLevel: 30 } });
      const pick = stepUntil(game, isType('pickTaken')) as PickEvent;
      if (pick.taken.id !== 'stacking-power') continue;
      const first = partyUnits(game)[0]!.power;
      stepUntil(game, (event) => event.type === 'floorEntered' && event.floor === 3);
      expect(partyUnits(game)[0]!.power).toBeCloseTo(first * (1 + 0.04 * 2));
      return;
    }
    throw new Error('no Seed took Stacking power');
  });
});

describe('The Pick rule', () => {
  it('starts as the default, and the player can reorder it at any time', () => {
    const game = createGame({ seed: 1 });
    expect(viewGame(game).pickPriority).toEqual(DEFAULT_PICK_PRIORITY);
    stepUntil(game, isType('battleStarted'));
    const critFirst: PickTag[] = ['crit', ...DEFAULT_PICK_PRIORITY.filter((tag) => tag !== 'crit')];
    expect(applyAction(game, { type: 'setPickPriority', priority: critFirst })).toEqual({ ok: true });
    expect(viewGame(game).pickPriority).toEqual(critFirst);
    expect(viewGame(deserializeGame(serializeGame(game))!).pickPriority).toEqual(critFirst);
  });

  it('refuses a rule that misses or repeats a tag', () => {
    const game = createGame({ seed: 1 });
    for (const priority of [PICK_TAGS.slice(1), [...PICK_TAGS.slice(1), 'armour' as const]]) {
      expect(applyAction(game, { type: 'setPickPriority', priority })).toEqual({ ok: false, reason: 'badPickPriority' });
    }
    expect(viewGame(game).pickPriority).toEqual(DEFAULT_PICK_PRIORITY);
  });

  it('chooses the next Picks', () => {
    const critFirst: PickTag[] = ['crit', ...DEFAULT_PICK_PRIORITY.filter((tag) => tag !== 'crit')];
    let offered = 0;
    for (let seed = 0; seed < 40; seed++) {
      const game = createGame({ seed });
      applyAction(game, { type: 'setPickPriority', priority: critFirst });
      const pick = stepUntil(game, isType('pickTaken')) as PickEvent;
      if (!pick.offers.some((offer) => offer.id === 'boon-crit')) continue;
      offered++;
      expect(pick.taken.id).toBe('boon-crit');
    }
    expect(offered).toBeGreaterThan(0);
  });
});

describe('The Away Report', () => {
  it('counts the Guardian fights and kills each Pick was held for', () => {
    const game = createGame({ seed: 2, scenario: { heroLevel: 40, startAt: { floor: 5, room: 'guardian' } } });
    const catchUp = beginCatchUp(game, 2 * 3_600_000);
    const report = continueCatchUp(game, catchUp, Number.MAX_SAFE_INTEGER)!;
    expect(report.guardianKills).toBeGreaterThan(0);
    expect(report.guardianPicks.length).toBeGreaterThan(0);
    const fights = report.guardianKills + (report.guardianAttempts?.attempts ?? 0);
    for (const record of report.guardianPicks) {
      expect(record.kills).toBeLessThanOrEqual(Math.min(record.fights, report.guardianKills));
      expect(record.fights).toBeLessThanOrEqual(fights);
    }
    // Most kills first, and every fight held at least its Guardian Pick.
    expect(report.guardianPicks[0]!.kills).toBe(Math.max(...report.guardianPicks.map((record) => record.kills)));
    expect(report.guardianPicks.reduce((total, record) => total + record.fights, 0)).toBeGreaterThanOrEqual(fights);
  });
});
