import { useLayoutEffect } from 'react';
import { chromePixel, uiScale } from './battleScene/draw';

/** Keeps `--ui-scale` current, which sizes the header and everything overlaid on the Battle scene, and `--px`, one pixel of the chrome. */
export function useUiScale(): void {
  useLayoutEffect(() => {
    const apply = (): void => {
      const scale = uiScale(window.innerWidth, window.innerHeight, window.devicePixelRatio);
      document.documentElement.style.setProperty('--ui-scale', String(scale));
      document.documentElement.style.setProperty('--px', `${chromePixel(scale, window.devicePixelRatio)}px`);
    };
    apply();
    // Moving to a display with another scale also fires this.
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);
}
