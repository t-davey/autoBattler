import { useState } from 'react';
import { AwayReportPanel } from './AwayReportPanel';
import { BattlePanel } from './BattlePanel';
import { DevTools } from './DevTools';
import { FloorMap } from './FloorMap';
import { LiveLog } from './LiveLog';
import { PlanningTab } from './PlanningTab';
import { StashTab } from './StashTab';
import type { Store } from './store';
import { TownMenu } from './TownMenu';
import { useGame } from './useGame';

type Tab = 'dashboard' | 'planning' | 'stash';

export function App({ store }: { store: Store }) {
  const { view, log, stash, catchUpProgress, awayReport, saveNotice, saveWarning } = useGame(store);
  const [tab, setTab] = useState<Tab>('dashboard');
  const unspent = view.heroes.reduce((total, hero) => total + hero.unspentPoints, 0);

  const tabButton = (id: Tab, label: string) => (
    <button type="button" role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
      {label}
    </button>
  );

  return (
    <>
      <div className="app-body" inert={catchUpProgress !== null}>
        <header className="app-header">
          <h1>autoBattler</h1>
          <nav className="tabs" role="tablist" aria-label="Screens">
            {tabButton('dashboard', 'Dashboard')}
            {tabButton('planning', unspent > 0 ? `Planning (${unspent} unspent)` : 'Planning')}
            {tabButton('stash', `Stash (${stash.length})`)}
          </nav>
          {import.meta.env.DEV ? <DevTools store={store} /> : null}
        </header>
        {saveWarning && <p className="save-banner" role="alert">{saveWarning}</p>}
        {saveNotice && (
          <p className="save-banner" role="status">
            {saveNotice} <button type="button" onClick={store.dismissSaveNotice}>Dismiss</button>
          </p>
        )}
        {awayReport && (
          <AwayReportPanel
            report={awayReport}
            heroes={view.heroes}
            onDismiss={store.dismissAwayReport}
            onOpenStash={() => setTab('stash')}
            onOpenPlanning={() => setTab('planning')}
          />
        )}
        {tab === 'dashboard' && (
          <main className="dashboard">
            <div className="dashboard-main">
              {view.phase === 'town' ? (
                <TownMenu view={view} dispatch={store.dispatch} />
              ) : (
                <>
                  <FloorMap view={view} />
                  <BattlePanel view={view} />
                </>
              )}
            </div>
            <LiveLog lines={log} />
          </main>
        )}
        {tab === 'planning' && (
          <main className="planning">
            <PlanningTab heroes={view.heroes} dispatch={store.dispatch} />
          </main>
        )}
        {tab === 'stash' && <StashTab stash={stash} heroes={view.heroes} dispatch={store.dispatch} />}
      </div>
      {catchUpProgress !== null && (
        <div className="catch-up" role="status">
          <p>Catching up...</p>
          <progress aria-label="Catch-up progress" value={catchUpProgress} />
        </div>
      )}
    </>
  );
}
