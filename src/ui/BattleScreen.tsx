import { useEffect, useRef } from 'react';
import { floorAt, type GameView, type HeroView, type UnitView } from '../sim';
import { figureOf } from './battleScene/art';
import { BattleScene } from './battleScene/BattleScene';
import { PORTRAIT, portraitPixels } from './battleScene/portrait';
import { floorLabel } from './floorLabel';
import { FloorMap } from './FloorMap';
import { LiveLog } from './LiveLog';
import type { LogLine, Store } from './store';

function effectsOf(unit: UnitView): string {
  return [
    unit.bleeding && 'Bleeding',
    unit.poisonStacks > 0 && `Poison ×${unit.poisonStacks}`,
    unit.wardAmount > 0 && `Ward ${Math.ceil(unit.wardAmount)}`,
  ]
    .filter((effect) => effect !== false)
    .join(' · ');
}

function healthText(unit: UnitView): string {
  // Floor scale can leave a long fraction here, such as 206.99999999999997.
  return unit.health <= 0 ? 'Fallen' : `${Math.ceil(unit.health)} / ${Math.ceil(unit.maxHealth)}`;
}

/** A Hero's Battle sprite, as the portrait on their plate. */
function Portrait({ unit }: { unit: UnitView }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const figure = figureOf(unit);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (context) context.putImageData(new ImageData(portraitPixels(figure), PORTRAIT.width, PORTRAIT.height), 0, 0);
  }, [figure]);
  return <canvas ref={canvas} className="hero-portrait" width={PORTRAIT.width} height={PORTRAIT.height} aria-hidden="true" />;
}

/** A Hero's plate in the console: portrait, level, health, Oil, and Effects. */
function HeroPlate({ unit, level }: { unit: UnitView; level: number | undefined }) {
  const fallen = unit.health <= 0;
  const effects = effectsOf(unit);
  return (
    <li className={fallen ? 'console-plate hero-plate unit-fallen' : 'console-plate hero-plate'}>
      <div className="hero-portrait-well">
        <Portrait unit={unit} />
      </div>
      <div className="hero-plate-body">
        <div className="unit-heading">
          <span className="unit-name">{unit.name}</span>
          {level !== undefined && <span className="hero-level">Lv {level}</span>}
        </div>
        <div className="gauge-row">
          <div
            className="health-bar"
            role="progressbar"
            aria-label={`${unit.name} health`}
            aria-valuemin={0}
            aria-valuemax={Math.ceil(unit.maxHealth)}
            aria-valuenow={Math.ceil(unit.health)}
          >
            <div className="health-fill" style={{ width: `${(Math.max(0, unit.health) / unit.maxHealth) * 100}%` }} />
          </div>
          <span className="gauge-text">{healthText(unit)}</span>
        </div>
        {unit.maxOil > 0 && (
          <div className="gauge-row">
            <div
              className="oil-bar"
              role="progressbar"
              aria-label={`${unit.name} Oil`}
              aria-valuemin={0}
              aria-valuemax={unit.maxOil}
              aria-valuenow={Math.floor(unit.oil)}
            >
              <div className="oil-fill" style={{ width: `${(unit.oil / unit.maxOil) * 100}%` }} />
            </div>
            <span className="gauge-text">Oil {Math.floor(unit.oil)}</span>
          </div>
        )}
        <span className="unit-effects">{!fallen && effects}</span>
      </div>
    </li>
  );
}

/** A Hero between Battles, with the health and Oil that carried out of the last one. */
function heroAsUnit(hero: HeroView): UnitView {
  return {
    id: hero.id,
    classId: hero.classId,
    name: hero.name,
    row: hero.row,
    reach: hero.reach,
    health: hero.health,
    maxHealth: hero.stats.maxHealth,
    placeholder: false,
    oil: hero.oil,
    maxOil: hero.stats.maxOil,
    bleeding: false,
    poisonStacks: 0,
    wardAmount: 0,
  };
}

/** One bar for the whole Pack. Each enemy's own bar and Effects are drawn on its sprite. */
function PackStatus({ enemies }: { enemies: readonly UnitView[] }) {
  const health = enemies.reduce((total, enemy) => total + Math.max(0, enemy.health), 0);
  const maxHealth = enemies.reduce((total, enemy) => total + enemy.maxHealth, 0);
  const standing = enemies.filter((enemy) => enemy.health > 0).length;
  return (
    <section className="pack-status" aria-label="Pack">
      <span>
        Pack: {standing} of {enemies.length} standing
      </span>
      <div className="health-bar" aria-hidden="true">
        <div className="health-fill" style={{ width: `${(health / maxHealth) * 100}%` }} />
      </div>
      <ul className="visually-hidden">
        {enemies.map((enemy) => (
          <li key={enemy.id}>
            {enemy.name}: {healthText(enemy)}
            {enemy.health > 0 && effectsOf(enemy) && `, ${effectsOf(enemy)}`}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The Battle screen: the scene set in an iron frame, with a rail above it and a console below. The scene fills what's between. */
export function BattleScreen({ view, log, store }: { view: GameView; log: readonly LogLine[]; store: Store }) {
  const { battle, phase, floor } = view;
  const party = battle ? battle.party : view.heroes.map(heroAsUnit);
  const levels = new Map<string, number>(view.heroes.map((hero) => [hero.id, hero.level]));
  return (
    <main className="battle-screen" aria-label="Battle" data-act={floor === null ? undefined : floorAt(floor).act}>
      <div className="battle-stage">
        <BattleScene store={store} />
      </div>
      <header className="battle-rail">
        <div className="battle-rail-inner">
          {floor !== null && (
            <h2 className="rail-nameplate">
              {floorLabel(floor)} of {floorAt(view.lampFloor).floor}
            </h2>
          )}
          {battle ? (
            <PackStatus enemies={battle.enemies} />
          ) : (
            <p className="travelling">{phase === 'chest' ? 'The Party searches a chest…' : 'The Party presses on into the dark…'}</p>
          )}
          {view.picks.length > 0 && (
            <ul className="run-picks" aria-label="Picks this Run">
              {view.picks.map((pick, index) => (
                <li key={index} title={pick.line}>
                  {pick.placeholder && '[placeholder] '}
                  {pick.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>
      <footer className="battle-console">
        <div className="battle-console-inner">
          <FloorMap view={view} />
          <ul className="party-status" aria-label="Party">
            {party.map((unit) => (
              <HeroPlate key={unit.id} unit={unit} level={levels.get(unit.id)} />
            ))}
          </ul>
          <div className="console-plate log-plate">
            <LiveLog lines={log} ledger />
          </div>
        </div>
      </footer>
    </main>
  );
}
