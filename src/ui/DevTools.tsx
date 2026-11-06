import type { Store } from './store';

const HOUR_MS = 3_600_000;

/** Rehearsal buttons. App renders this only under import.meta.env.DEV, so builds carry none of it. */
export function DevTools({ store }: { store: Store }) {
  const startOver = () => {
    store.startOver();
    window.location.reload();
  };
  return (
    <div className="dev-tools">
      <button type="button" onClick={() => store.catchUp(HOUR_MS)}>Skip 1 hour</button>
      <button type="button" onClick={startOver}>Start over</button>
    </div>
  );
}
