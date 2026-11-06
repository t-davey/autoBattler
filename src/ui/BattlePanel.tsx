import type { GameView, HeroView, Row, UnitView } from '../sim';

function UnitEffects({ unit }: { unit: UnitView }) {
  const effects = [
    unit.bleeding && 'Bleeding',
    unit.poisonStacks > 0 && `Poison ×${unit.poisonStacks}`,
    unit.wardAmount > 0 && `Ward ${Math.ceil(unit.wardAmount)}`,
  ].filter((effect) => effect !== false);
  if (effects.length === 0) return null;
  return <span className="unit-effects">{effects.join(' · ')}</span>;
}

function UnitCard({ unit }: { unit: UnitView }) {
  const health = Math.ceil(unit.health);
  // Floor scale can leave a long fraction here, such as 206.99999999999997.
  const maxHealth = Math.ceil(unit.maxHealth);
  const fallen = unit.health <= 0;
  return (
    <li className={fallen ? 'unit unit-fallen' : 'unit'}>
      <span className="unit-name">{unit.name}</span>
      <div
        className="health-bar"
        role="progressbar"
        aria-label={`${unit.name} health`}
        aria-valuemin={0}
        aria-valuemax={maxHealth}
        aria-valuenow={health}
      >
        <div className="health-fill" style={{ width: `${(unit.health / unit.maxHealth) * 100}%` }} />
      </div>
      <span className="unit-health">{fallen ? 'Fallen' : `${health} / ${maxHealth}`}</span>
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
      {!fallen && <UnitEffects unit={unit} />}
    </li>
  );
}

function RowColumn({ label, row, units }: { label: string; row: Row; units: readonly UnitView[] }) {
  return (
    <section className="row" aria-label={label}>
      <h3>{label}</h3>
      <ul className="row-units">
        {units
          .filter((unit) => unit.row === row)
          .map((unit) => (
            <UnitCard key={unit.id} unit={unit} />
          ))}
      </ul>
    </section>
  );
}

/** The Party between Battles, with the health and Oil that carried out of the last one. */
function PartyStatus({ heroes }: { heroes: readonly HeroView[] }) {
  const asUnit = (hero: HeroView): UnitView => ({
    id: hero.id,
    name: hero.name,
    row: 'front',
    health: hero.health,
    maxHealth: hero.stats.maxHealth,
    oil: hero.oil,
    maxOil: hero.stats.maxOil,
    bleeding: false,
    poisonStacks: 0,
    wardAmount: 0,
  });
  return (
    <ul className="row-units party-status" aria-label="Party">
      {heroes.map((hero) => (
        <UnitCard key={hero.id} unit={asUnit(hero)} />
      ))}
    </ul>
  );
}

export function BattlePanel({ view }: { view: GameView }) {
  const { battle, phase } = view;
  return (
    <section className="panel battle-panel" aria-label="Battle">
      <h2>Battle</h2>
      {battle ? (
        <div className="battlefield">
          <RowColumn label="Party back Row" row="back" units={battle.party} />
          <RowColumn label="Party front Row" row="front" units={battle.party} />
          <RowColumn label="Enemy front Row" row="front" units={battle.enemies} />
          <RowColumn label="Enemy back Row" row="back" units={battle.enemies} />
        </div>
      ) : (
        <>
          <p className="travelling">{phase === 'chest' ? 'The Party searches a chest…' : 'The Party presses on into the dark…'}</p>
          <PartyStatus heroes={view.heroes} />
        </>
      )}
    </section>
  );
}
