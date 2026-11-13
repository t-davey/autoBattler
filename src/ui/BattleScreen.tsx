import { floorAt, type GameView, type HeroView, type UnitView } from '../sim';
import { BattleScene } from './battleScene/BattleScene';
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

function PartyCard({ unit }: { unit: UnitView }) {
  const fallen = unit.health <= 0;
  const effects = effectsOf(unit);
  return (
    <li className={fallen ? 'unit unit-fallen' : 'unit'}>
      <div className="unit-heading">
        <span className="unit-name">{unit.name}</span>
        <span className="unit-health">{healthText(unit)}</span>
      </div>
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
      {unit.maxOil > 0 && (
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
      )}
      {!fallen && effects && <span className="unit-effects">{effects}</span>}
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

export function BattleScreen({ view, log, store }: { view: GameView; log: readonly LogLine[]; store: Store }) {
  const { battle, phase } = view;
  const party = battle ? battle.party : view.heroes.map(heroAsUnit);
  return (
    <main className="battle-screen" aria-label="Battle" data-act={view.floor === null ? undefined : floorAt(view.floor).act}>
      <BattleScene store={store} />
      <div className="battle-overlay">
        <FloorMap view={view} />
        {battle ? (
          <PackStatus enemies={battle.enemies} />
        ) : (
          <p className="travelling">{phase === 'chest' ? 'The Party searches a chest…' : 'The Party presses on into the dark…'}</p>
        )}
        <ul className="party-status" aria-label="Party">
          {party.map((unit) => (
            <PartyCard key={unit.id} unit={unit} />
          ))}
        </ul>
        <LiveLog lines={log} bare />
      </div>
    </main>
  );
}
