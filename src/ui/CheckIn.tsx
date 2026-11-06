import { useState } from 'react';
import type { AwayReport, GameView, ItemView } from '../sim';
import { describeAbsence } from './describeAwayReport';
import { describeFindings, type Finding, type FindingKind } from './describeFindings';
import { ItemCompare, StashPicker } from './ItemCompare';
import { PlanningTab } from './PlanningTab';
import { emptyStashQuery, type StashQuery } from './stashQuery';
import type { Dispatch } from './store';

const ICONS: Readonly<Record<FindingKind, string>> = { setbacks: '☠', loot: '▣', points: '✦' };

function StashFix({ stash, view, dispatch, initial }: { stash: readonly ItemView[]; view: GameView; dispatch: Dispatch; initial: StashQuery }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = stash.find((item) => item.id === selectedId) ?? null;
  return (
    <div className="check-in-stash">
      <div className="check-in-scroll">
        <StashPicker stash={stash} initial={initial} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <div className="check-in-scroll">
        <ItemCompare item={selected} heroes={view.heroes} dispatch={dispatch} />
      </div>
    </div>
  );
}

function FindingFix({ finding, stash, view, dispatch }: { finding: Finding; stash: readonly ItemView[]; view: GameView; dispatch: Dispatch }) {
  if (finding.kind === 'points') return <div className="check-in-scroll"><PlanningTab heroes={view.heroes} dispatch={dispatch} /></div>;
  const initial: StashQuery = finding.kind === 'loot' ? { ...emptyStashQuery, rarity: 'rare' } : { ...emptyStashQuery, stat: finding.stat ?? 'all' };
  return <StashFix stash={stash} view={view} dispatch={dispatch} initial={initial} />;
}

export interface CheckInProps {
  readonly report: AwayReport;
  readonly view: GameView;
  readonly stash: readonly ItemView[];
  readonly dispatch: Dispatch;
  readonly onSendBack: () => void;
}

/** The Away Report as a list of Findings, each opening its fix beside the list. The Party waits until it's sent back. */
export function CheckIn({ report, view, stash, dispatch, onSendBack }: CheckInProps) {
  const [openKind, setOpenKind] = useState<FindingKind | null>(null);
  const findings = describeFindings(report, view);
  const open = findings.find((finding) => finding.kind === openKind) ?? null;
  return (
    <main className="check-in">
      <section className="check-in-report" aria-label="Away Report">
        <h2>Away Report</h2>
        <p className="hint">
          {describeAbsence(report)} Floors cleared: {report.floorsCleared}. Deepest Floor: {report.deepestFloor}.
        </p>
        {report.setbacks.length === 0 && <p>No Setbacks.</p>}
        {report.guardianKills > 0 && <p>Guardian kills: {report.guardianKills}.</p>}
        {report.lampRelit && <p className="lamp-lit">The Lamp is relit.</p>}
        <ul className="findings">
          {findings.map((finding) => (
            <li key={finding.kind}>
              <button type="button" className="finding" aria-pressed={finding.kind === openKind} onClick={() => setOpenKind(finding.kind)}>
                <span className="finding-icon" aria-hidden="true">{ICONS[finding.kind]}</span>
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
        <button type="button" className="send-back" onClick={onSendBack}>Send the Party back</button>
      </section>
      <section className="panel check-in-fix" aria-label="Fix">
        {open ? (
          <FindingFix key={open.kind} finding={open} stash={stash} view={view} dispatch={dispatch} />
        ) : (
          <p className="hint">Pick a Finding to act on it, or send the Party back as it is.</p>
        )}
      </section>
    </main>
  );
}
