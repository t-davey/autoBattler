import { memo, useEffect, useRef } from 'react';
import type { Store } from '../store';
import { drawScene, snappedDisplayWidth } from './draw';
import { ART_HEIGHT, ART_WIDTH } from './iso';
import { bakeRoom, type BakedRoom } from './roomBake';
import { createStage } from './stage';

const MAX_FRAME_SECONDS = 0.1;

/** The Canvas view of the current Room. It runs off the store, outside React's renders.
 *  Stopping with the window is fine: the clock is the driver's, and the scene catches up by jumping. */
export const BattleScene = memo(function BattleScene({ store }: { store: Store }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    const holder = element?.parentElement;
    if (!element || !context || !holder) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stage = createStage({ shakes: !reducedMotion });
    stage.sync(store.getSnapshot().view);
    const stopPlayed = store.onPlayed((batch) => stage.play(batch, store.getSnapshot().view));

    const fit = (): void => {
      const width = snappedDisplayWidth(holder.clientWidth, window.devicePixelRatio);
      element.style.width = `${width}px`;
      element.style.height = `${(width * ART_HEIGHT) / ART_WIDTH}px`;
    };
    const resizes = new ResizeObserver(fit);
    resizes.observe(holder);
    fit();

    const image = context.createImageData(ART_WIDTH, ART_HEIGHT);
    let room: BakedRoom | null = null;
    let bakedFor = '';
    let last = performance.now();
    let frameRequest = 0;
    const draw = (time: number): void => {
      frameRequest = requestAnimationFrame(draw);
      // The first frame's timestamp can be earlier than the clock read before it.
      stage.advance(Math.max(0, Math.min(MAX_FRAME_SECONDS, (time - last) / 1000)));
      last = time;
      stage.sync(store.getSnapshot().view);
      const frame = stage.frame();
      if (!frame.look) return;
      const wanted = `${frame.look.key}:${frame.lampLit}`;
      if (!room || wanted !== bakedFor) {
        room = bakeRoom(frame.look, frame.lampLit);
        bakedFor = wanted;
      }
      drawScene(image.data, room, frame);
      const shake = Math.round(frame.shake);
      const shakeX = shake > 0 ? Math.round((Math.random() * 2 - 1) * shake) : 0;
      const shakeY = shake > 0 ? Math.round((Math.random() * 2 - 1) * shake) : 0;
      if (shake > 0) context.clearRect(0, 0, ART_WIDTH, ART_HEIGHT);
      context.putImageData(image, shakeX, shakeY);
    };
    frameRequest = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRequest);
      resizes.disconnect();
      stopPlayed();
    };
  }, [store]);

  return (
    <div className="battle-scene">
      <canvas ref={canvas} width={ART_WIDTH} height={ART_HEIGHT} role="img" aria-label="The Party in the current Room" />
    </div>
  );
});
