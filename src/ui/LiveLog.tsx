import { useLayoutEffect, useRef } from 'react';
import type { LogLine } from './store';

const NEAR_BOTTOM_PX = 24;

/** `bare` drops the panel, for lying directly over the Battle scene. */
export function LiveLog({ lines, bare = false }: { lines: readonly LogLine[]; bare?: boolean }) {
  const listRef = useRef<HTMLUListElement>(null);
  const followingRef = useRef(true);

  // Follows the newest line, unless the player has scrolled up to read.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && followingRef.current) list.scrollTop = list.scrollHeight;
  }, [lines]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    followingRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
  };

  return (
    <section className={bare ? 'live-log live-log-bare' : 'panel live-log'} aria-label="Live Log">
      {!bare && <h2>Live Log</h2>}
      <ul ref={listRef} className="log-lines" onScroll={onScroll}>
        {lines.map((line) => (
          <li key={line.id} className={line.rarity ? `rarity-${line.rarity}` : undefined}>{line.text}</li>
        ))}
      </ul>
    </section>
  );
}
