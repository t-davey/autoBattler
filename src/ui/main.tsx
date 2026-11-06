import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createGame, type GameSetup } from '../sim';
import { App } from './App';
import { devSetup } from './devSetup';
import { startDriver } from './driver';
import { createStore } from './store';
import './style.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app element missing from index.html');

// Started outside React, so effects and Strict Mode can't start a second loop.
const fresh: GameSetup = { seed: Date.now() >>> 0 };
const store = createStore(createGame(import.meta.env.DEV ? devSetup(window.location.search, fresh) : fresh));
startDriver({ now: Date.now, isHidden: () => document.hidden, step: store.advance });

createRoot(root).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);
