import { useState } from 'react';
import type { AwayReport, GameView, ItemView } from '../sim';
import { describeAbsence } from './describeAwayReport';
import { floorLabel } from './floorLabel';
import { describeFindings, type Finding, type FindingKind } from './describeFindings';
import { PartyStash } from './PartyStash';
import { PixelIcon, type IconName } from './PixelIcon';
import { PickRule } from './PickRule';
import { PlanningTab } from './PlanningTab';
import { emptyStashQuery, type StashQuery } from './stashQuery';
import type { Dispatch } from './store';

const FINDING_ICONS: Readonly<Record<FindingKind, IconName>> = { setbacks: 'skull', picks: 'cog', loot: 'chest', points: 'flame' };

function FindingFix({ finding, report, stash, seenItemId, view, dispatch }: { finding: Finding; report: AwayReport; stash: readonly ItemView[]; seenItemId: number; view: GameView; dispatch: Dispatch }) {
  if (finding.kind === 'points') return <div className="check-in-scroll"><PlanningTab heroes={view.heroes} pickPriority={view.pickPriority} dispatch={dispatch} /></div>;
  if (finding.kind === 'picks') return <PickRule priority={view.pickPriority} dispatch={dispatch} />;
  const notable = report.loot.unique > 0 ? 'unique' : report.loot.rare > 0 ? 'rare' : 'all';
  const initial: StashQuery = finding.kind === 'loot' ? { ...emptyStashQuery, rarity: notable } : { ...emptyStashQuery, stat: finding.stat ?? 'all' };
  return <PartyStash stash={stash} heroes={view.heroes} dispatch={dispatch} seenItemId={seenItemId} initial={initial} rules={view} />;
}

export interface CheckInProps {
  readonly report: AwayReport;
  readonly view: GameView;
  readonly stash: readonly ItemView[];
  readonly seenItemId: number;
  readonly dispatch: Dispatch;
  readonly onSendBack: () => void;
}

/** The Away Report as a list of Findings, each opening its fix beside the list. The Party waits until it's sent back. */
export function CheckIn({ report, view, stash, seenItemId, dispatch, onSendBack }: CheckInProps) {
  const [openKind, setOpenKind] = useState<FindingKind | null>(null);
  const findings = describeFindings(report, view);
  const open = findings.find((finding) => finding.kind === openKind) ?? null;
  return (
    <main className="check-in">
      <section className="check-in-report" aria-label="Away Report">
        <h2>Away Report</h2>
        <p className="hint">
          {describeAbsence(report)} Floors cleared: {report.floorsCleared}. Deepest Floor: {report.deepestFloor > 0 ? floorLabel(report.deepestFloor) : 'none'}. Damage dealt: {Math.round(report.damageDealt).toLocaleString('en-GB')}. Healed: {Math.round(report.healed).toLocaleString('en-GB')}.
        </p>
        <ul className="findings">
          {findings.map((finding) => (
            <li key={finding.kind}>
              <button type="button" className="finding" aria-pressed={finding.kind === openKind} onClick={() => setOpenKind(finding.kind)}>
                <PixelIcon name={FINDING_ICONS[finding.kind]} className="finding-icon" />
                <span>
                  <strong>{finding.title}</strong>
                  {finding.details.map((line) => (
                    <span key={line} className="hint finding-detail">{line}</span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {report.setbacks.length === 0 && <p>No Setbacks.</p>}
        {report.guardianKills > 0 && <p>Guardian kills: {report.guardianKills}.</p>}
        {report.lampRelit && <p className="lamp lamp-lit"><PixelIcon name="lantern" /> The Lamp is relit.</p>}
        <button type="button" className="lit-button send-back" onClick={onSendBack}>Send the Party back</button>
      </section>
      <section className="panel check-in-fix" aria-label="Fix">
        {open ? (
          <FindingFix key={open.kind} finding={open} report={report} stash={stash} seenItemId={seenItemId} view={view} dispatch={dispatch} />
        ) : (
          <p className="hint">{findings.length > 0 ? 'Pick a Finding to act on it, or send the Party back as it is.' : 'Nothing here to act on. Send the Party back.'}</p>
        )}
      </section>
    </main>
  );
}
