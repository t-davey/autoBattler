import type { GameView, RoomKind, RoomView } from '../sim';
import { PixelIcon, type IconName } from './PixelIcon';

const ROOM_ICONS: Readonly<Record<RoomKind, IconName>> = { battle: 'battle', chest: 'chest', stairs: 'stairs', guardian: 'cog' };
const ROOM_NAMES: Readonly<Record<RoomKind, string>> = { battle: 'Battle', chest: 'Chest', stairs: 'Stairs', guardian: 'Guardian' };

function RoomCell({ room, order, column, row }: { room: RoomView; order: number; column: number; row: number }) {
  const party = room.state === 'current';
  const label = `Room ${order}: ${ROOM_NAMES[room.kind]}, ${room.state}${party ? ', the Party is here' : ''}`;
  return (
    <li className={`room room-${room.state} room-${room.kind}`} style={{ gridColumn: column, gridRow: row }} aria-label={label} title={label}>
      <PixelIcon name={party ? 'lantern' : ROOM_ICONS[room.kind]} />
    </li>
  );
}

/** The space the map's tiles may fill on its plate in the console, in base-window pixels. */
const MAP_WIDTH_PX = 176;
const MAP_HEIGHT_PX = 100;
const MAX_TILE_STEP_PX = 26;
const TILE_GAP_PX = 2;

/** The DOM tile map, on its plate in the Battle screen's console. ADR 0003 keeps it behind this one component.
 *  It crops to the Rooms in use, and its tiles fill the plate up to a cap. */
export function FloorMap({ view }: { view: GameView }) {
  const { map } = view;
  if (!map) return null;
  const left = Math.min(...map.rooms.map((room) => room.x));
  const top = Math.min(...map.rooms.map((room) => room.y));
  const columns = Math.max(...map.rooms.map((room) => room.x)) - left + 1;
  const rows = Math.max(...map.rooms.map((room) => room.y)) - top + 1;
  const tile = Math.floor(Math.min(MAP_WIDTH_PX / columns, MAP_HEIGHT_PX / rows, MAX_TILE_STEP_PX)) - TILE_GAP_PX;
  const style = {
    gap: TILE_GAP_PX,
    // A whole multiple of the icons' 8 pixels, so they stay crisp.
    fontSize: Math.max(8, Math.floor((tile * 0.75) / 8) * 8),
    gridTemplateColumns: `repeat(${columns}, ${tile}px)`,
    gridTemplateRows: `repeat(${rows}, ${tile}px)`,
  };
  return (
    <section className="floor-map console-plate" aria-label="Floor map">
      <ol className="room-grid" style={style}>
        {map.rooms.map((room, index) => (
          <RoomCell key={`${room.x},${room.y}`} room={room} order={index + 1} column={room.x - left + 1} row={room.y - top + 1} />
        ))}
      </ol>
      <p className="floor-progress">
        {map.rooms.filter((room) => room.state === 'cleared').length} of {map.rooms.length} Rooms cleared
      </p>
    </section>
  );
}
