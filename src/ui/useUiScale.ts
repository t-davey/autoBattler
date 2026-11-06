import { useLayoutEffect } from 'react';
import { uiScale } from './battleScene/draw';

/** Keeps `--ui-scale` current, which sizes the header and everything overlaid on the Battle scene. */
export function useUiScale(): void {
  useLayoutEffect(() => {
    const apply = (): void => {
      document.documentElement.style.setProperty('--ui-scale', String(uiScale(window.innerWidth, window.innerHeight, window.devicePixelRatio)));
    };
    apply();
    // Moving to a display with another scale also fires this.
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);
}
