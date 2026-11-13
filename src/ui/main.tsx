import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createGame, type ClassId, type Game, type GameSetup } from '../sim';
import { App } from './App';
import { devSetup } from './devSetup';
import { startDriver } from './driver';
import { localStorageSave } from './localStorageSave';
import { NewGame } from './NewGame';
import { loadSave } from './save';
import { createStore } from './store';
// Letterpress civic: docs/design.md#palette says what each face is for.
import '@fontsource/grenze-gotisch/600.css';
import '@fontsource/grenze-gotisch/800.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/alegreya/400.css';
import '@fontsource/alegreya/400-italic.css';
import '@fontsource/alegreya/700.css';
import '@fontsource/cedarville-cursive/400.css';
import './style.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app element missing from index.html');

/** The Seed of every new game. `npm run balance -- demo-seed` finds Seeds that play the demo script. */
const DEMO_SEED = 8;

const reactRoot = createRoot(root);
const { saved, notice } = loadSave(localStorageSave);

/** Started outside React, so effects and Strict Mode can't start a second loop. */
function play(game: Game, advancedTo: number, seenItemId: number | undefined): void {
  const store = createStore(game, { saves: localStorageSave, saveNotice: notice, ...(seenItemId === undefined ? {} : { seenItemId }) });
  const driver = startDriver({ now: Date.now, isHidden: () => document.hidden, store, advancedTo });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) driver.save();
  });
  window.addEventListener('pagehide', driver.save);
  reactRoot.render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  );
}

// A save wins over ?seed= and the rest, which take effect after "Start over".
// Without one, the player picks a Party, unless a dev build names one with ?party=.
const fresh = (party: readonly ClassId[]): GameSetup => {
  const setup = { seed: DEMO_SEED, party };
  return import.meta.env.DEV ? devSetup(window.location.search, setup) : setup;
};
if (saved) play(saved.game, saved.savedAt, saved.seenItemId);
else if (import.meta.env.DEV && devSetup(window.location.search, { seed: DEMO_SEED }).party) play(createGame(fresh([])), Date.now(), undefined);
else {
  reactRoot.render(
    <StrictMode>
      <NewGame onStart={(party) => play(createGame(fresh(party)), Date.now(), undefined)} />
    </StrictMode>,
  );
}
