import { TICK_MS, type GameView } from '../sim';
import type { Store } from './store';

/** Shown while the Party is in Town: a button, a countdown, and how the Wall stands. */
export function TownMenu({ view, dispatch }: { view: GameView; dispatch: Store['dispatch'] }) {
  const seconds = Math.ceil(((view.townTicksLeft ?? 0) * TICK_MS) / 1_000);
  const { lampLit, setbacksTowardsFallback, setbacksToFallBack, fallenBack } = view.wall;
  return (
    <section className="panel town-menu" aria-label="Town">
      <h2>Town</h2>
      <p>Health and Oil are restored.</p>
      <p>The Party leaves on its own in {seconds} s.</p>
      <button type="button" onClick={() => dispatch({ type: 'sendParty' })}>
        Send the Party
      </button>
      <p className={lampLit ? 'lamp lamp-lit' : 'lamp'}>{lampLit ? 'The Lamp is lit.' : 'The Lamp is dark.'}</p>
      <p>
        {fallenBack
          ? 'Fallen back: Runs turn back before the Guardian until a Hero levels up, a skill point is spent, or an item is equipped.'
          : `Setbacks towards falling back: ${setbacksTowardsFallback} of ${setbacksToFallBack}.`}
      </p>
    </section>
  );
}
