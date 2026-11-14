import { useState } from 'react';
import { BattleScreen } from './BattleScreen';
import { CheckIn } from './CheckIn';
import { DevTools } from './DevTools';
import { LiveLog } from './LiveLog';
import { PixelIcon } from './PixelIcon';
import { PlanningTab } from './PlanningTab';
import { StashTab } from './StashTab';
import type { Store } from './store';
import { TownMenu } from './TownMenu';
import { TownTab } from './TownTab';
import { useGame } from './useGame';
import { useUiScale } from './useUiScale';

type Tab = 'dashboard' | 'planning' | 'stash' | 'town';

export function App({ store }: { store: Store }) {
  const { view, log, stash, seenItemId, catchUpProgress, awayReport, saveNotice, saveWarning } = useGame(store);
  const [tab, setTab] = useState<Tab>('dashboard');
  useUiScale();
  const unspent = view.heroes.reduce((total, hero) => total + hero.unspentPoints, 0);
  const sendBack = () => {
    store.sendPartyBack();
    setTab('dashboard');
  };

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
          {!awayReport && (
            <nav className="tabs" role="tablist" aria-label="Screens">
              {tabButton('dashboard', 'Dashboard')}
              {tabButton('planning', unspent > 0 ? `Planning (${unspent} unspent)` : 'Planning')}
              {tabButton('stash', `Stash (${stash.length})`)}
              {tabButton('town', 'Town')}
            </nav>
          )}
          <span className="header-purse" aria-label="Gold">{view.gold.toLocaleString()} gold</span>
          {import.meta.env.DEV ? <DevTools store={store} /> : null}
        </header>
        {saveWarning && <p className="save-banner" role="alert">{saveWarning}</p>}
        {saveNotice && (
          <p className="save-banner" role="status">
            {saveNotice} <button type="button" onClick={store.dismissSaveNotice}>Dismiss</button>
          </p>
        )}
        {awayReport && <CheckIn report={awayReport} view={view} stash={stash} seenItemId={seenItemId} dispatch={store.dispatch} onSendBack={sendBack} />}
        {!awayReport && tab === 'dashboard' && view.phase !== 'town' && <BattleScreen view={view} log={log} store={store} />}
        {!awayReport && tab === 'dashboard' && view.phase === 'town' && (
          <main className="dashboard">
            <div className="dashboard-main">
              <TownMenu view={view} dispatch={store.dispatch} />
            </div>
            <LiveLog lines={log} />
          </main>
        )}
        {!awayReport && tab === 'planning' && (
          <main className="planning">
            <PlanningTab heroes={view.heroes} pickPriority={view.pickPriority} dispatch={store.dispatch} />
          </main>
        )}
        {!awayReport && tab === 'town' && <TownTab view={view} dispatch={store.dispatch} />}
        {!awayReport && tab === 'stash' && <StashTab stash={stash} heroes={view.heroes} dispatch={store.dispatch} seenItemId={seenItemId} rules={view} />}
      </div>
      {catchUpProgress !== null && (
        <div className="catch-up" role="status">
          <p><PixelIcon name="lantern" className="flicker" /> Catching up...</p>
          <progress aria-label="Catch-up progress" value={catchUpProgress} />
        </div>
      )}
    </>
  );
}
