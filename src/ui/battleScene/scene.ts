import type { DamageType, GameEvent, GameView, Reach, Row, SkillId, UnitView } from '../../sim';
import type { PlayedBatch } from '../store';
import { figureOf, type Figure, type Rgb } from './art';
import { formationPoint, wayPoint, type Point } from './iso';
import { roomLookOf, type RoomLook } from './roomLook';

/** More Ticks than this in one batch are a jump: the scene shows the result and skips the animation. */
export const MAX_ANIMATED_TICKS = 20;

const REST_ANGLE = 0.95;
const WALK_SPEED = 55;
const LEAVE_SPEED = 110;
const LEAVE_SECONDS = 0.7;
const FADE_SECONDS = 0.2;
const DISSOLVE_SECONDS = 0.55;
const BORN_SECONDS = 0.4;
const FLASH_SECONDS = 0.09;
const KICK_SECONDS = 0.25;
export const NUMBER_SECONDS = 0.9;
const WARD_COLOUR: Rgb = [255, 206, 110];
const HEAL_COLOUR: Rgb = [244, 206, 120];
const BLEED_COLOUR: Rgb = [244, 110, 96];
const HIT_FLASH: Rgb = [246, 232, 208];
const DAMAGE_COLOURS: Readonly<Record<DamageType, Rgb>> = {
  physical: [238, 232, 214],
  poison: [170, 214, 96],
  fire: [255, 150, 70],
  cold: [150, 200, 240],
  holy: [255, 236, 170],
};
const SPARKS: readonly Rgb[] = [[255, 226, 160], [255, 170, 80], [240, 240, 220]];
const BLOOD: readonly Rgb[] = [[190, 40, 40], [130, 24, 30], [230, 80, 70]];
const SPORES: readonly Rgb[] = [[130, 164, 72], [92, 124, 58], [170, 204, 90]];
const BONE_BITS: readonly Rgb[] = [[214, 206, 176], [138, 144, 98], [98, 92, 74]];
const DUST: readonly Rgb[] = [[120, 112, 100], [88, 82, 74], [160, 150, 130]];
const MOTES: readonly Rgb[] = [[255, 226, 150], [255, 186, 90]];

interface Pose {
  readonly dx: number;
  readonly dy: number;
  readonly lean: number;
  readonly squash: number;
  readonly angle: number;
  readonly smear: readonly [number, number] | null;
  readonly glow: number;
}

const STILL: Pose = { dx: 0, dy: 0, lean: 0, squash: 1, angle: REST_ANGLE, smear: null, glow: 0 };

interface Move {
  readonly unitId: string;
  readonly duration: number;
  readonly triggerAt: number;
  onTrigger: () => void;
  readonly pose: (t: number) => Pose;
  readonly tick: number | null;
  t: number;
  fired: boolean;
  freezeUntil: number;
}

interface SceneUnit {
  readonly id: string;
  readonly figure: Figure;
  readonly team: 'party' | 'enemy';
  readonly bornAt: number;
  row: Row;
  reach: Reach;
  health: number;
  maxHealth: number;
  /** Health the scene hasn't shown as lost yet, because these blows are still on their way. */
  pendingDamage: number;
  pendingBlows: number;
  oil: number;
  maxOil: number;
  bleeding: boolean;
  poisoned: boolean;
  warded: boolean;
  bracedUntil: number;
  x: number;
  y: number;
  home: Point;
  walking: boolean;
  flashUntil: number;
  flashColour: Rgb;
  kick: number;
  kickedAt: number;
  deathPending: boolean;
  diedAt: number | null;
}

export interface Particle {
  x: number;
  y: number;
  readonly vx: number;
  vy: number;
  readonly gravity: number;
  readonly bornAt: number;
  readonly life: number;
  readonly colour: Rgb;
}

export interface FloatingNumber {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly colour: Rgb;
  readonly bornAt: number;
}

export interface Ring {
  readonly x: number;
  readonly y: number;
  readonly bornAt: number;
  readonly duration: number;
  readonly radius: number;
  readonly colour: Rgb;
}

export interface LightFlash {
  readonly x: number;
  readonly y: number;
  readonly bornAt: number;
  readonly duration: number;
  readonly radius: number;
  readonly strength: number;
}

interface Bullet {
  readonly from: Point;
  readonly to: Point;
  readonly bornAt: number;
  readonly duration: number;
  readonly arc: number;
  readonly colour: Rgb;
  readonly onLand: () => void;
}

export interface BulletFrame extends Point {
  readonly colour: Rgb;
}

export interface UnitFrame {
  readonly id: string;
  readonly figure: Figure;
  readonly team: 'party' | 'enemy';
  readonly x: number;
  readonly y: number;
  readonly lean: number;
  readonly squash: number;
  readonly angle: number;
  readonly smear: readonly [number, number] | null;
  readonly flash: Rgb | null;
  /** 0 is whole. 1 has crumbled away. */
  readonly dissolve: number;
  readonly hop: boolean;
  readonly health: number;
  readonly maxHealth: number;
  readonly warded: boolean;
  readonly braced: boolean;
  /** How full the lantern is, 0-1, or null for a Unit with none. */
  readonly lantern: number | null;
  readonly lanternFlare: number;
}

export interface SceneFrame {
  readonly time: number;
  readonly look: RoomLook | null;
  readonly lampLit: boolean;
  readonly chestOpen: boolean;
  readonly units: readonly UnitFrame[];
  readonly particles: readonly Particle[];
  readonly numbers: readonly FloatingNumber[];
  readonly rings: readonly Ring[];
  readonly flashes: readonly LightFlash[];
  readonly bullets: readonly BulletFrame[];
  /** In art pixels. */
  readonly shake: number;
  /** 0 is clear. 1 is black. */
  readonly fade: number;
}

export interface Scene {
  /** Takes what the Game just did, and animates it unless it covers too much time. */
  play(batch: PlayedBatch, view: GameView): void;
  /** Follows the Game's current state. Safe to call every frame. */
  sync(view: GameView): void;
  advance(seconds: number): void;
  frame(): SceneFrame;
}

export interface SceneOptions {
  readonly random?: () => number;
  /** Set false when the player prefers reduced motion. */
  readonly shakes?: boolean;
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const clamp01 = (k: number): number => Math.max(0, Math.min(1, k));
const easeOut = (k: number): number => 1 - (1 - k) * (1 - k);

const SPREADS: Readonly<Record<number, readonly number[]>> = { 1: [0], 2: [-0.85, 0.85], 3: [-1.4, 0, 1.4] };

function standingPoint(team: 'party' | 'enemy', row: Row, index: number, count: number): Point {
  const across = row === 'front' ? 1.2 : 2.4;
  const spread = SPREADS[count]?.[index] ?? (index - (count - 1) / 2) * 0.9;
  return formationPoint(team === 'party' ? -across : across, spread);
}

interface Swing {
  readonly windup: number;
  readonly dash: number;
  readonly hold: number;
  readonly recover: number;
  readonly raised: number;
  readonly struck: number;
  readonly lean: number;
  readonly gap: number;
  readonly stop: number;
  readonly shake: number;
}

const STRIKE: Swing = { windup: 0.17, dash: 0.09, hold: 0.1, recover: 0.24, raised: -2.2, struck: 1.1, lean: 10, gap: 30, stop: 0.07, shake: 1 };
const CUT: Swing = { windup: 0.09, dash: 0.06, hold: 0.06, recover: 0.2, raised: -1.6, struck: 1.3, lean: 12, gap: 24, stop: 0.04, shake: 0 };
const CLAW: Swing = { windup: 0.3, dash: 0.13, hold: 0.07, recover: 0.34, raised: -1.9, struck: 1, lean: 9, gap: 30, stop: 0.05, shake: 0 };
const SLAM: Swing = { windup: 0.4, dash: 0.1, hold: 0.14, recover: 0.36, raised: -2.4, struck: 1.2, lean: 14, gap: 44, stop: 0.09, shake: 2 };
const CUTTING_SKILLS: ReadonlySet<SkillId> = new Set<SkillId>(['bleeders-cut', 'the-long-cut']);
/** Skills that fly to their target whatever weapon the Hero holds. */
const SHOT_SKILLS: ReadonlySet<SkillId> = new Set<SkillId>(['tainted-shaft', 'votive-spark', 'chill-word', 'flare']);
/** Skills cast without a hit, drawn as a short cast. */
const CAST_SKILLS: ReadonlySet<SkillId> = new Set<SkillId>(['sow-rot', 'bloom', 'wasting-curse']);

export function createScene({ random = Math.random, shakes = true }: SceneOptions = {}): Scene {
  let now = 0;
  let look: RoomLook | null = null;
  let lampLit = false;
  let chestOpen = false;
  let shake = 0;
  let transition: { readonly to: RoomLook; readonly startedAt: number; readonly leaves: boolean; swapped: boolean } | null = null;
  const units = new Map<string, SceneUnit>();
  let moves: Move[] = [];
  let bullets: Bullet[] = [];
  let particles: Particle[] = [];
  let numbers: FloatingNumber[] = [];
  let rings: Ring[] = [];
  let flashes: LightFlash[] = [];

  const burst = (x: number, y: number, count: number, colours: readonly Rgb[], speed: number, gravity: number, life: number): void => {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const velocity = speed * (0.4 + random() * 0.8);
      particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - speed * 0.3, gravity, bornAt: now, life: life * (0.6 + random() * 0.6), colour: colours[i % colours.length]! });
    }
  };

  const floatNumber = (unit: SceneUnit, text: string, colour: Rgb): void => {
    numbers.push({ x: unit.x + (random() * 16 - 8), y: unit.y - 60, text, colour, bornAt: now });
  };

  const flash = (unit: SceneUnit, colour: Rgb = HIT_FLASH, seconds = FLASH_SECONDS): void => {
    unit.flashUntil = now + seconds;
    unit.flashColour = colour;
  };

  const crumble = (unit: SceneUnit): void => {
    unit.deathPending = false;
    unit.diedAt = now;
    if (unit.team === 'enemy') {
      burst(unit.x, unit.y - 30, 22, BONE_BITS, 120, 340, 0.8);
      rings.push({ x: unit.x, y: unit.y, bornAt: now, duration: 0.35, radius: 34, colour: [120, 110, 90] });
    }
  };

  const shownHit = (target: SceneUnit, attacker: SceneUnit, damage: number, absorbed: number, crit: boolean, type: DamageType, style: Swing | null): void => {
    target.pendingBlows = Math.max(0, target.pendingBlows - 1);
    target.pendingDamage = target.pendingBlows === 0 ? 0 : Math.max(0, target.pendingDamage - damage);
    const direction = attacker.team === 'party' ? 1 : -1;
    target.kick = direction * (crit ? 9 : 6);
    target.kickedAt = now;
    if (damage === 0 && absorbed > 0) {
      flash(target, WARD_COLOUR);
      floatNumber(target, '0', WARD_COLOUR);
      burst(target.x - direction * 16, target.y - 30, 10, [WARD_COLOUR, [255, 180, 90]], 140, 120, 0.35);
    } else {
      flash(target);
      floatNumber(target, String(Math.ceil(damage)), DAMAGE_COLOURS[type]);
      if (style === CUT) burst(target.x - direction * 16, target.y - 30, 12, BLOOD, 190, 360, 0.32);
      else if (type === 'poison') burst(target.x, target.y - 26, 14, SPORES, 50, -44, 0.9);
      else burst(target.x - direction * 16, target.y - 30, crit ? 16 : 10, SPARKS, 160, 360, 0.32);
      flashes.push({ x: target.x, y: target.y - 26, bornAt: now, duration: 0.12, radius: 60, strength: 0.8 });
    }
    if (shakes && style) shake = Math.max(shake, style.shake + (crit ? 1 : 0));
    if (target.deathPending && target.pendingBlows === 0) crumble(target);
  };

  const swingMove = (attacker: SceneUnit, target: SceneUnit, swing: Swing, tick: number, land: () => void): Move => {
    const towards = attacker.team === 'party' ? 1 : -1;
    const landedAt = swing.windup + swing.dash;
    const total = landedAt + swing.hold + swing.recover;
    const pose = (t: number): Pose => {
      const reachX = target.x - towards * swing.gap - attacker.x;
      const reachY = target.y - attacker.y;
      if (t < swing.windup) {
        const k = easeOut(t / swing.windup);
        return { ...STILL, dx: -towards * 5 * k, lean: -7 * k, squash: 1 - 0.08 * k, angle: lerp(REST_ANGLE, swing.raised, k) };
      }
      if (t < landedAt) {
        const k = (t - swing.windup) / swing.dash;
        const eased = k * k;
        const angle = lerp(swing.raised, swing.struck, eased);
        return { ...STILL, dx: lerp(-towards * 5, reachX, eased), dy: reachY * eased, lean: lerp(-7, swing.lean, k), angle, smear: [swing.raised, angle] };
      }
      if (t < landedAt + swing.hold) {
        return { ...STILL, dx: reachX, dy: reachY, lean: swing.lean, angle: swing.struck, smear: t < landedAt + 0.06 ? [swing.raised, swing.struck] : null };
      }
      const k = easeOut((t - landedAt - swing.hold) / swing.recover);
      return { ...STILL, dx: reachX * (1 - k), dy: reachY * (1 - k), lean: swing.lean * (1 - k), angle: lerp(swing.struck, REST_ANGLE, k) };
    };
    const move: Move = { unitId: attacker.id, duration: total, triggerAt: landedAt, pose, tick, t: 0, fired: false, freezeUntil: 0, onTrigger: () => {
      land();
      move.freezeUntil = now + swing.stop;
    } };
    return move;
  };

  const shotMove = (attacker: SceneUnit, target: SceneUnit, tick: number, colour: Rgb, arc: number, land: () => void): Move => {
    const away = attacker.team === 'party' ? -1 : 1;
    return {
      unitId: attacker.id,
      duration: 0.7,
      triggerAt: 0.26,
      tick,
      t: 0,
      fired: false,
      freezeUntil: 0,
      onTrigger: () => {
        const from = { x: attacker.x - away * 18, y: attacker.y - 46 };
        bullets.push({ from, to: { x: target.x, y: target.y - 28 }, bornAt: now, duration: 0.3, arc, colour, onLand: land });
      },
      pose: (t) => {
        if (t < 0.22) {
          const k = easeOut(t / 0.22);
          return { ...STILL, squash: 1 - 0.22 * k, lean: -5 * k };
        }
        if (t < 0.34) {
          const k = (t - 0.22) / 0.12;
          return { ...STILL, squash: lerp(0.78, 1, k), lean: lerp(-5, 8, k), dy: -4 * Math.sin(k * Math.PI) };
        }
        return { ...STILL, lean: 8 * (1 - clamp01((t - 0.34) / 0.3)) };
      },
    };
  };

  const castMove = (unit: SceneUnit, duration: number, triggerAt: number, flare: number, onTrigger: () => void): Move => ({
    unitId: unit.id,
    duration,
    triggerAt,
    tick: null,
    t: 0,
    fired: false,
    freezeUntil: 0,
    onTrigger,
    pose: (t) => {
      const k = Math.sin(clamp01(t / duration) * Math.PI);
      return { ...STILL, dy: -4 * k, lean: 4 * k, glow: k * flare };
    },
  });

  const braceMove = (unit: SceneUnit): Move => ({
    unitId: unit.id,
    duration: 0.7,
    triggerAt: 0.27,
    tick: null,
    t: 0,
    fired: false,
    freezeUntil: 0,
    onTrigger: () => {
      unit.bracedUntil = now + 6;
      if (shakes) shake = Math.max(shake, 2);
      rings.push({ x: unit.x, y: unit.y, bornAt: now, duration: 0.35, radius: 64, colour: [176, 180, 190] });
      burst(unit.x, unit.y - 2, 16, DUST, 140, 240, 0.45);
    },
    pose: (t) => {
      if (t < 0.2) {
        const k = t / 0.2;
        return { ...STILL, dy: -12 * Math.sin((k * Math.PI) / 2), lean: -5 * k, angle: lerp(REST_ANGLE, -0.6, k) };
      }
      if (t < 0.27) {
        const k = (t - 0.2) / 0.07;
        return { ...STILL, dy: -12 * (1 - k * k), lean: lerp(-5, 6, k), angle: -0.6 };
      }
      const k = clamp01((t - 0.27) / 0.25);
      return { ...STILL, squash: lerp(0.8, 1, easeOut(k)), lean: 6 * (1 - k), angle: lerp(-0.6, REST_ANGLE, k) };
    },
  });

  const startMove = (move: Move): void => {
    // A move cut off still lands, so its target's bar and death aren't left waiting.
    for (const other of moves) {
      if (other.unitId === move.unitId && !other.fired) {
        other.fired = true;
        other.onTrigger();
      }
    }
    moves = moves.filter((other) => other.unitId !== move.unitId);
    moves.push(move);
  };

  const playAttack = (event: Extract<GameEvent, { type: 'attack' }>, style: Swing | null, shot: boolean): void => {
    const attacker = units.get(event.attackerId);
    const target = units.get(event.targetId);
    if (!attacker || !target) return;
    target.pendingDamage += event.damage;
    target.pendingBlows += 1;
    const land = (hitStyle: Swing | null): void => shownHit(target, attacker, event.damage, event.absorbed, event.crit, event.damageType, hitStyle);
    // A hit split by Shared Burden comes from the blow already under way.
    const blowUnderWay = moves.find((move) => move.unitId === attacker.id && move.tick === event.tick && !move.fired);
    if (blowUnderWay) {
      const landFirst = blowUnderWay.onTrigger;
      blowUnderWay.onTrigger = () => {
        landFirst();
        land(null);
      };
      return;
    }
    if (attacker.reach === 'ranged' || shot) {
      const lobbed = event.damageType === 'poison';
      const colour = lobbed ? SPORES[2]! : event.damageType === 'physical' ? ([214, 206, 176] as Rgb) : DAMAGE_COLOURS[event.damageType];
      startMove(shotMove(attacker, target, event.tick, colour, lobbed ? 44 : 10, () => land(null)));
      return;
    }
    const swing = style ?? (attacker.team === 'party' ? STRIKE : CLAW);
    startMove(swingMove(attacker, target, swing, event.tick, () => land(swing)));
  };

  const ward = (unit: SceneUnit): void => {
    flash(unit, [255, 226, 160], 0.08);
  };

  const castWard = (caster: SceneUnit): void => {
    startMove(castMove(caster, 0.95, 0.25, 1.2, () => {
      rings.push({ x: caster.x, y: caster.y, bornAt: now, duration: 0.55, radius: 190, colour: [255, 200, 110] });
      flashes.push({ x: caster.x, y: caster.y - 40, bornAt: now, duration: 0.5, radius: 150, strength: 0.6 });
    }));
  };

  const heal = (target: SceneUnit, amount: number): void => {
    floatNumber(target, `+${Math.ceil(amount)}`, HEAL_COLOUR);
    flash(target, [255, 226, 160], 0.14);
    flashes.push({ x: target.x, y: target.y - 26, bornAt: now, duration: 0.7, radius: 90, strength: 0.7 });
    for (let i = 0; i < 12; i++) {
      particles.push({ x: target.x + (random() * 30 - 15), y: target.y - random() * 16, vx: 0, vy: -68, gravity: 0, bornAt: now, life: 0.3 + random() * 0.4, colour: MOTES[i % 2]! });
    }
  };

  const playEvents = (events: readonly GameEvent[]): void => {
    const styles = new Map<string, Swing>();
    const shooters = new Set<string>();
    for (const event of events) {
      switch (event.type) {
        case 'skill': {
          const unit = units.get(event.unitId);
          if (!unit) break;
          if (event.skillId === 'bar-the-way') startMove(braceMove(unit));
          else if (event.skillId === 'lantern-ward') castWard(unit);
          else if (event.skillId === 'mend-by-lamplight') startMove(castMove(unit, 0.85, 0.22, 1, () => {}));
          else if (CUTTING_SKILLS.has(event.skillId)) styles.set(event.unitId, CUT);
          else if (SHOT_SKILLS.has(event.skillId)) shooters.add(event.unitId);
          else if (CAST_SKILLS.has(event.skillId)) startMove(castMove(unit, 0.8, 0.25, 0, () => {}));
          break;
        }
        case 'action': {
          const unit = units.get(event.unitId);
          if (!unit) break;
          if (event.actionName === 'Grave Slam') styles.set(event.unitId, SLAM);
          else startMove(castMove(unit, 0.8, 0.3, 0, () => {
            rings.push({ x: unit.x, y: unit.y, bornAt: now, duration: 0.5, radius: 170, colour: SPORES[2]! });
            burst(unit.x, unit.y - 40, 24, SPORES, 120, -30, 0.9);
          }));
          break;
        }
        case 'attack':
          playAttack(event, styles.get(event.attackerId) ?? null, shooters.has(event.attackerId));
          break;
        case 'effectDamage': {
          const unit = units.get(event.targetId);
          if (!unit) break;
          if (event.damage > 0) floatNumber(unit, String(Math.ceil(event.damage)), event.effect === 'bleed' ? BLEED_COLOUR : DAMAGE_COLOURS[event.damageType]);
          else if (event.absorbed > 0) floatNumber(unit, '0', WARD_COLOUR);
          break;
        }
        case 'dodge': {
          const unit = units.get(event.targetId);
          if (unit) floatNumber(unit, 'dodge', HIT_FLASH);
          break;
        }
        case 'heal': {
          const unit = units.get(event.targetId);
          if (unit) heal(unit, event.amount);
          break;
        }
        case 'ward': {
          const unit = units.get(event.targetId);
          if (unit) ward(unit);
          break;
        }
        case 'death': {
          const unit = units.get(event.unitId);
          if (!unit || unit.diedAt !== null) break;
          if (unit.pendingBlows > 0) unit.deathPending = true;
          else crumble(unit);
          break;
        }
        case 'heroRose': {
          const unit = units.get(event.heroId);
          if (unit) flash(unit, [255, 226, 160], 0.3);
          break;
        }
        default:
          break;
      }
    }
  };

  const syncRoom = (view: GameView): RoomLook | null => {
    const { map, floor } = view;
    if (!map || !floor) return look;
    const index = map.rooms.findIndex((room) => room.state === 'current');
    if (index < 0) return look;
    return roomLookOf(map, floor, index);
  };

  const fanOf = (unit: SceneUnit): number => (unit.id === 'sin-eater' ? -14 : unit.id === 'lamplighter' ? 14 : 0);

  const enterRoom = (next: RoomLook): void => {
    look = next;
    const wayIn = next.ways.find((way) => way.role === 'in');
    if (!wayIn) return;
    const point = wayPoint(wayIn.edge);
    for (const unit of units.values()) {
      if (unit.team !== 'party') continue;
      unit.x = point.x + fanOf(unit);
      unit.y = point.y + fanOf(unit) * 0.5;
    }
  };

  const unitFromView = (view: UnitView, team: 'party' | 'enemy'): SceneUnit => ({
    id: view.id,
    figure: figureOf(view),
    team,
    bornAt: now,
    row: view.row,
    reach: view.reach,
    health: view.health,
    maxHealth: view.maxHealth,
    pendingDamage: 0,
    pendingBlows: 0,
    oil: view.oil,
    maxOil: view.maxOil,
    bleeding: view.bleeding,
    poisoned: view.poisonStacks > 0,
    warded: view.wardAmount > 0,
    bracedUntil: 0,
    x: 0,
    y: 0,
    home: { x: 0, y: 0 },
    walking: false,
    flashUntil: 0,
    flashColour: HIT_FLASH,
    kick: 0,
    kickedAt: -9,
    deathPending: false,
    diedAt: null,
  });

  /** A batch's blows land later, so while reading one, its deaths wait for its events. */
  const syncUnits = (view: GameView, settleDeaths: boolean): void => {
    const party: readonly UnitView[] = view.battle
      ? view.battle.party
      : view.heroes.map((hero) => ({
          id: hero.id,
          placeholder: false,
          name: hero.name,
          row: hero.row,
          reach: hero.reach,
          health: hero.health,
          maxHealth: hero.stats.maxHealth,
          oil: hero.oil,
          maxOil: hero.stats.maxOil,
          bleeding: false,
          poisonStacks: 0,
          wardAmount: 0,
        }));
    const enemies = view.battle?.enemies ?? [];
    const seen = new Set<string>();
    for (const [team, list] of [['party', party], ['enemy', enemies]] as const) {
      for (const row of ['front', 'back'] as const) {
        const standing = list.filter((unit) => unit.row === row && unit.health > 0);
        standing.forEach((unit, index) => {
          let known = units.get(unit.id);
          // Enemy ids repeat between Packs, so a fallen or different Unit under this id is a new one.
          if (known && team === 'enemy' && (known.diedAt !== null || known.deathPending || known.figure !== figureOf(unit))) {
            units.delete(unit.id);
            known = undefined;
          }
          const home = standingPoint(team, row, index, standing.length);
          if (known) known.home = home;
          else {
            const fresh = unitFromView(unit, team);
            fresh.home = home;
            fresh.x = home.x;
            fresh.y = home.y;
            units.set(unit.id, fresh);
          }
        });
      }
      for (const unit of list) {
        seen.add(unit.id);
        let shown = units.get(unit.id);
        if (!shown) {
          // Already down when this scene first saw it.
          shown = unitFromView(unit, team);
          shown.home = standingPoint(team, unit.row, 0, 1);
          shown.x = shown.home.x;
          shown.y = shown.home.y;
          shown.diedAt = now - DISSOLVE_SECONDS;
          units.set(unit.id, shown);
        }
        shown.row = unit.row;
        shown.reach = unit.reach;
        shown.health = unit.health;
        shown.maxHealth = unit.maxHealth;
        shown.oil = unit.oil;
        shown.maxOil = unit.maxOil;
        shown.bleeding = unit.bleeding;
        shown.poisoned = unit.poisonStacks > 0;
        shown.warded = unit.wardAmount > 0;
        if (unit.health > 0 && team === 'party') shown.diedAt = null;
        if (settleDeaths && unit.health <= 0 && shown.diedAt === null && !shown.deathPending && shown.pendingBlows === 0) crumble(shown);
      }
    }
    if (!settleDeaths) return;
    for (const unit of units.values()) {
      if (!seen.has(unit.id) && unit.diedAt === null && !unit.deathPending && unit.pendingBlows === 0) crumble(unit);
    }
  };

  const syncView = (view: GameView, settleDeaths = true): void => {
    lampLit = view.wall.lampLit;
    chestOpen = view.phase === 'chest';
    const next = syncRoom(view);
    syncUnits(view, settleDeaths);
    if (!next) return;
    if (!look) {
      if (view.phase === 'travelling') enterRoom(next);
      else look = next;
      return;
    }
    const shownOrComing = transition ? transition.to : look;
    if (next.key === shownOrComing.key) return;
    if (transition && !transition.swapped) enterRoom(transition.to);
    transition = { to: next, startedAt: now, leaves: look.ways.some((way) => way.role === 'out'), swapped: false };
  };

  const snap = (view: GameView): void => {
    moves = [];
    bullets = [];
    particles = [];
    numbers = [];
    rings = [];
    flashes = [];
    shake = 0;
    transition = null;
    for (const unit of units.values()) {
      unit.pendingDamage = 0;
      unit.pendingBlows = 0;
      unit.deathPending = false;
    }
    syncView(view);
    transition = null;
    const shown = syncRoom(view);
    if (shown) look = shown;
    const stale: string[] = [];
    for (const unit of units.values()) {
      unit.x = unit.home.x;
      unit.y = unit.home.y;
      unit.walking = false;
      if (unit.diedAt !== null) {
        unit.diedAt = now - DISSOLVE_SECONDS;
        if (unit.team === 'enemy') stale.push(unit.id);
      }
    }
    for (const id of stale) units.delete(id);
    particles = [];
    rings = [];
  };

  const updateTransition = (): void => {
    if (!transition) return;
    const age = now - transition.startedAt;
    const leaveFor = transition.leaves ? LEAVE_SECONDS : 0;
    if (!transition.swapped && age >= leaveFor) {
      enterRoom(transition.to);
      transition.swapped = true;
    }
    if (age >= leaveFor + FADE_SECONDS) transition = null;
  };

  const walkTargetOf = (unit: SceneUnit): Point => {
    if (transition && !transition.swapped && transition.leaves && unit.team === 'party') {
      const out = look?.ways.find((way) => way.role === 'out');
      if (out) return wayPoint(out.edge);
    }
    return unit.home;
  };

  const walk = (unit: SceneUnit, seconds: number): void => {
    if (unit.diedAt !== null) return;
    const target = walkTargetOf(unit);
    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const distance = Math.hypot(dx, dy);
    const leaving = target !== unit.home;
    const step = (leaving ? LEAVE_SPEED : WALK_SPEED) * seconds;
    unit.walking = distance > 1;
    if (distance <= Math.max(step, 0)) {
      unit.x = target.x;
      unit.y = target.y;
    } else {
      unit.x += (dx / distance) * step;
      unit.y += (dy / distance) * step;
    }
  };

  const drip = (unit: SceneUnit, seconds: number): void => {
    if (unit.diedAt !== null) return;
    if (unit.bleeding && random() < seconds * 7) {
      particles.push({ x: unit.x + (random() * 16 - 8), y: unit.y - 26, vx: 0, vy: 24, gravity: 180, bornAt: now, life: 0.35, colour: [176, 32, 36] });
    }
    if (unit.poisoned && random() < seconds * 6) {
      particles.push({ x: unit.x + (random() * 20 - 10), y: unit.y - 18, vx: 0, vy: -28, gravity: 0, bornAt: now, life: 0.55, colour: [140, 176, 76] });
    }
  };

  return {
    play(batch, view) {
      if (batch.ticks === null || batch.ticks > MAX_ANIMATED_TICKS) {
        snap(view);
        return;
      }
      syncView(view, false);
      playEvents(batch.events);
    },
    sync: (view) => syncView(view),
    advance(seconds) {
      now += seconds;
      updateTransition();
      for (const move of moves) {
        if (now >= move.freezeUntil) move.t += seconds;
        if (!move.fired && move.t >= move.triggerAt) {
          move.fired = true;
          move.onTrigger();
        }
      }
      moves = moves.filter((move) => move.t < move.duration);
      bullets = bullets.filter((bullet) => {
        if (now - bullet.bornAt < bullet.duration) return true;
        bullet.onLand();
        return false;
      });
      for (const particle of particles) {
        particle.vy += particle.gravity * seconds;
        particle.x += particle.vx * seconds;
        particle.y += particle.vy * seconds;
      }
      particles = particles.filter((particle) => now - particle.bornAt < particle.life);
      numbers = numbers.filter((number) => now - number.bornAt < NUMBER_SECONDS);
      rings = rings.filter((ring) => now - ring.bornAt < ring.duration);
      flashes = flashes.filter((light) => now - light.bornAt < light.duration);
      shake = Math.max(0, shake - seconds * 9);
      for (const unit of units.values()) {
        walk(unit, seconds);
        drip(unit, seconds);
        if (unit.team === 'enemy' && unit.diedAt !== null && now - unit.diedAt >= DISSOLVE_SECONDS) units.delete(unit.id);
      }
    },
    frame() {
      const leaving = transition !== null && !transition.swapped;
      const frames: UnitFrame[] = [];
      for (const unit of units.values()) {
        if (unit.team === 'enemy' && leaving) continue;
        const move = moves.find((candidate) => candidate.unitId === unit.id);
        const pose = move ? move.pose(Math.min(move.t, move.duration)) : STILL;
        const kickAge = now - unit.kickedAt;
        const kick = kickAge < KICK_SECONDS ? unit.kick * (1 - kickAge / KICK_SECONDS) : 0;
        const fallen = unit.diedAt !== null;
        const crumbling = fallen && unit.diedAt !== null ? clamp01((now - unit.diedAt) / DISSOLVE_SECONDS) : 0;
        const bornFor = now - unit.bornAt;
        const arriving = unit.team === 'enemy' && bornFor < BORN_SECONDS ? 1 - bornFor / BORN_SECONDS : 0;
        const lanternFull = unit.maxOil > 0 ? clamp01(unit.oil / unit.maxOil) : null;
        frames.push({
          id: unit.id,
          figure: unit.figure,
          team: unit.team,
          x: unit.x + pose.dx + kick,
          y: unit.y + pose.dy,
          lean: pose.lean,
          squash: pose.squash * (fallen ? 1 - 0.7 * crumbling : 1),
          angle: pose.angle,
          smear: pose.smear,
          flash: now < unit.flashUntil ? unit.flashColour : null,
          dissolve: unit.team === 'enemy' ? Math.max(crumbling, arriving) : 0,
          hop: unit.walking && !move && Math.sin(now * 14) > 0,
          health: Math.min(unit.maxHealth, Math.max(0, unit.health + unit.pendingDamage)),
          maxHealth: unit.maxHealth,
          warded: unit.warded,
          braced: now < unit.bracedUntil,
          lantern: lanternFull,
          lanternFlare: pose.glow,
        });
      }
      let fade = 0;
      if (transition) {
        const age = now - transition.startedAt;
        const leaveFor = transition.leaves ? LEAVE_SECONDS : 0;
        const fadeOutFrom = Math.max(0, leaveFor - FADE_SECONDS);
        fade = age < leaveFor ? clamp01((age - fadeOutFrom) / FADE_SECONDS) : 1 - clamp01((age - leaveFor) / FADE_SECONDS);
      }
      return {
        time: now,
        look,
        lampLit,
        chestOpen,
        units: frames,
        particles,
        numbers,
        rings,
        flashes,
        bullets: bullets.map((bullet) => {
          const k = clamp01((now - bullet.bornAt) / bullet.duration);
          return { x: lerp(bullet.from.x, bullet.to.x, k), y: lerp(bullet.from.y, bullet.to.y, k) - Math.sin(k * Math.PI) * bullet.arc, colour: bullet.colour };
        }),
        shake,
        fade,
      };
    },
  };
}
