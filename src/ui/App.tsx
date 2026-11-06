import { useState } from 'react';
import { BattlePanel } from './BattlePanel';
import { FloorMap } from './FloorMap';
import { LiveLog } from './LiveLog';
import { PlanningTab } from './PlanningTab';
import { StashTab } from './StashTab';
import type { Store } from './store';
import { TownMenu } from './TownMenu';
import { useGame } from './useGame';

type Tab = 'dashboard' | 'planning' | 'stash';

export function App({ store }: { store: Store }) {
  const { view, log, stash } = useGame(store);
  const [tab, setTab] = useState<Tab>('dashboard');
  const unspent = view.heroes.reduce((total, hero) => total + hero.unspentPoints, 0);

  const tabButton = (id: Tab, label: string) => (
    <button type="button" role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
      {label}
    </button>
  );

  return (
    <>
      <header className="app-header">
        <h1>autoBattler</h1>
        <nav className="tabs" role="tablist" aria-label="Screens">
          {tabButton('dashboard', 'Dashboard')}
          {tabButton('planning', unspent > 0 ? `Planning (${unspent} unspent)` : 'Planning')}
          {tabButton('stash', `Stash (${stash.length})`)}
        </nav>
      </header>
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
    </>
  );
}
