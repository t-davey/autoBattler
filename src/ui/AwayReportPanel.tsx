import type { AwayReport, GameView } from '../sim';
import { describeAbsence, describeSetbacks } from './describeAwayReport';

export interface AwayReportPanelProps {
  readonly report: AwayReport;
  readonly heroes: GameView['heroes'];
  readonly onDismiss: () => void;
  readonly onOpenStash: () => void;
  readonly onOpenPlanning: () => void;
}

/** Stays up across tabs, so the player can read it while they equip and spend. */
export function AwayReportPanel({ report, heroes, onDismiss, onOpenStash, onOpenPlanning }: AwayReportPanelProps) {
  const { loot } = report;
  const nameOf = (id: string) => heroes.find((hero) => hero.id === id)?.name ?? id;
  return (
    <section className="panel away-report" aria-label="Away Report">
      <div className="away-report-head">
        <h2>Away Report</h2>
        <button type="button" onClick={onDismiss}>Dismiss</button>
      </div>
      <p>{describeAbsence(report)}</p>
      <ul>
        <li>Floors cleared: {report.floorsCleared}. Deepest Floor: {report.deepestFloor}.</li>
        {report.setbacks.length === 0 ? <li>No Setbacks.</li> : describeSetbacks(report.setbacks).map((line) => <li key={line}>{line}.</li>)}
        {report.guardianKills > 0 && <li>Guardian kills: {report.guardianKills}.</li>}
        {report.lampRelit && <li className="lamp-lit">The Lamp is relit.</li>}
        {report.fellBack && <li>The Party fell back, and turns back before the Guardian until it grows stronger.</li>}
        {report.levels.map(({ heroId, from, to }) => (
          <li key={heroId}>{nameOf(heroId)}: level {from} to {to}.</li>
        ))}
        <li>Loot: {loot.common} common, {loot.magic} magic, {loot.rare} rare.</li>
        {loot.notable.map((item) => (
          <li key={item.id} className="rarity-rare">{item.name}</li>
        ))}
        <li>Unspent skill points: {report.unspentSkillPoints}.</li>
      </ul>
      <div className="away-report-links">
        <button type="button" onClick={onOpenStash}>Open the Stash</button>
        <button type="button" onClick={onOpenPlanning}>Open Planning</button>
      </div>
    </section>
  );
}
