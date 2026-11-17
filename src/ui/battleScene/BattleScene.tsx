import { memo, useEffect, useRef } from 'react';
import type { Store } from '../store';
import { drawScene, sceneFit } from './draw';
import { FRAMING, type View } from './iso';
import { bakeRoom, sameView, type BakedRoom } from './roomBake';
import { createScene } from './scene';

const MAX_FRAME_SECONDS = 0.1;

/** The Canvas view of the current Room, filling its holder. It runs off the store, outside React's renders.
 *  Stopping with the window is fine: the clock is the driver's, and the scene catches up by jumping. */
export const BattleScene = memo(function BattleScene({ store }: { store: Store }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    const holder = element?.parentElement;
    if (!element || !context || !holder) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = createScene({ shakes: !reducedMotion });
    scene.sync(store.getSnapshot().view);
    const stopPlayed = store.onPlayed((batch) => scene.play(batch, store.getSnapshot().view));

    let view: View = FRAMING;
    let image = context.createImageData(view.width, view.height);
    const fit = (): void => {
      const fitted = sceneFit(holder.clientWidth, holder.clientHeight, window.devicePixelRatio);
      element.style.width = `${fitted.cssWidth}px`;
      element.style.height = `${fitted.cssHeight}px`;
      if (sameView(fitted.view, view)) return;
      // Positions are in the framing's pixels, so the scene carries on unchanged; only the bake covers more or less of the world.
      view = fitted.view;
      element.width = view.width;
      element.height = view.height;
      image = context.createImageData(view.width, view.height);
    };
    const resizes = new ResizeObserver(fit);
    resizes.observe(holder);
    // Moving to a display with another scale changes the ratio without resizing the holder.
    window.addEventListener('resize', fit);
    fit();

    let room: BakedRoom | null = null;
    let bakedFor = '';
    let last = performance.now();
    let frameRequest = 0;
    const draw = (time: number): void => {
      frameRequest = requestAnimationFrame(draw);
      // The first frame's timestamp can be earlier than the clock read before it.
      scene.advance(Math.max(0, Math.min(MAX_FRAME_SECONDS, (time - last) / 1000)));
      last = time;
      scene.sync(store.getSnapshot().view);
      const frame = scene.frame();
      if (!frame.look) return;
      const wanted = `${frame.look.key}:${frame.lampLit}`;
      if (!room || wanted !== bakedFor || !sameView(room.view, view)) {
        room = bakeRoom(frame.look, frame.lampLit, view);
        bakedFor = wanted;
      }
      drawScene(image.data, room, frame);
      const shake = Math.round(frame.shake);
      const shakeX = shake > 0 ? Math.round((Math.random() * 2 - 1) * shake) : 0;
      const shakeY = shake > 0 ? Math.round((Math.random() * 2 - 1) * shake) : 0;
      if (shake > 0) context.clearRect(0, 0, view.width, view.height);
      context.putImageData(image, shakeX, shakeY);
    };
    frameRequest = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRequest);
      resizes.disconnect();
      window.removeEventListener('resize', fit);
      stopPlayed();
    };
  }, [store]);

  return (
    <div className="battle-scene">
      <canvas ref={canvas} width={FRAMING.width} height={FRAMING.height} role="img" aria-label="The Party in the current Room" />
    </div>
  );
});
