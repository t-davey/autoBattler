import type { SaveStore } from './save';

/** Browser storage (G20). Even reaching window.localStorage can throw, so each call does it afresh. */
export const localStorageSave: SaveStore = {
  read: (key) => window.localStorage.getItem(key),
  write: (key, value) => window.localStorage.setItem(key, value),
  remove: (key) => window.localStorage.removeItem(key),
};
