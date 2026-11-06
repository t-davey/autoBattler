import type { BattleView, Row, UnitView } from '../sim';

function UnitCard({ unit }: { unit: UnitView }) {
  const health = Math.ceil(unit.health);
  const fallen = unit.health <= 0;
  return (
    <li className={fallen ? 'unit unit-fallen' : 'unit'}>
      <span className="unit-name">{unit.name}</span>
      <div
        className="health-bar"
        role="progressbar"
        aria-label={`${unit.name} health`}
        aria-valuemin={0}
        aria-valuemax={unit.maxHealth}
        aria-valuenow={health}
      >
        <div className="health-fill" style={{ width: `${(unit.health / unit.maxHealth) * 100}%` }} />
      </div>
      <span className="unit-health">{fallen ? 'Fallen' : `${health} / ${unit.maxHealth}`}</span>
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

export function BattlePanel({ battle }: { battle: BattleView | null }) {
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
        <p className="travelling">The Party presses on into the dark…</p>
      )}
    </section>
  );
}
