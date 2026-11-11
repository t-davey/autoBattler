import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createGame, type GameSetup } from '../sim';
import { App } from './App';
import { devSetup } from './devSetup';
import { startDriver } from './driver';
import { localStorageSave } from './localStorageSave';
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

// Started outside React, so effects and Strict Mode can't start a second loop.
// A save wins over ?seed= and the rest, which take effect after "Start over".
const fresh: GameSetup = { seed: DEMO_SEED };
const { saved, notice } = loadSave(localStorageSave);
const game = saved?.game ?? createGame(import.meta.env.DEV ? devSetup(window.location.search, fresh) : fresh);
const store = createStore(game, { saves: localStorageSave, saveNotice: notice, ...(saved?.seenItemId === undefined ? {} : { seenItemId: saved.seenItemId }) });
const driver = startDriver({ now: Date.now, isHidden: () => document.hidden, store, advancedTo: saved?.savedAt ?? Date.now() });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) driver.save();
});
window.addEventListener('pagehide', driver.save);

createRoot(root).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);
