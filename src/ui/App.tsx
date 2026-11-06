import { BattlePanel } from './BattlePanel';
import { LiveLog } from './LiveLog';
import type { Store } from './store';
import { useGame } from './useGame';

export function App({ store }: { store: Store }) {
  const { view, log } = useGame(store);
  return (
    <>
      <header className="app-header">
        <h1>autoBattler</h1>
      </header>
      <main className="dashboard">
        <BattlePanel battle={view.battle} />
        <LiveLog lines={log} />
      </main>
    </>
  );
}
