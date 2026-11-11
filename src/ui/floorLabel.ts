import { floorAt, type Depth } from '../sim';

/** "Act 1, Floor 3": how players see a depth. */
export function floorLabel(depth: Depth): string {
  const { act, floor } = floorAt(depth);
  return `Act ${act}, Floor ${floor}`;
}
