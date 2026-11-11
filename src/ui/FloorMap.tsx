import { floorAt, type GameView, type RoomKind, type RoomView } from '../sim';
import { floorLabel } from './floorLabel';
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

/** Keeps the map's far corner above the top of the Room's wall, whose slope is 1 down for 2 across.
 *  In base-window pixels, for a map under its heading in the top-left corner. */
const WALL_CLEARANCE_PX = 302;
const MAX_TILE_STEP_PX = 54;
const TILE_GAP_PX = 2;

/** The DOM tile map. ADR 0003 keeps it behind this one component.
 *  It crops to the Rooms in use, and its tiles fill the corner up to a cap. */
export function FloorMap({ view }: { view: GameView }) {
  const { map, floor } = view;
  if (!map || floor === null) return null;
  const left = Math.min(...map.rooms.map((room) => room.x));
  const top = Math.min(...map.rooms.map((room) => room.y));
  const columns = Math.max(...map.rooms.map((room) => room.x)) - left + 1;
  const rows = Math.max(...map.rooms.map((room) => room.y)) - top + 1;
  const tile = Math.floor(Math.min(WALL_CLEARANCE_PX / (rows + columns / 2), MAX_TILE_STEP_PX)) - TILE_GAP_PX;
  const style = {
    gap: TILE_GAP_PX,
    // A whole multiple of the icons' 8 pixels, so they stay crisp.
    fontSize: Math.max(8, Math.floor((tile * 0.6) / 8) * 8),
    gridTemplateColumns: `repeat(${columns}, ${tile}px)`,
    gridTemplateRows: `repeat(${rows}, ${tile}px)`,
  };
  return (
    <section className="floor-map" aria-label="Floor map">
      <h2>{floorLabel(floor)} of {floorAt(view.lampFloor).floor}</h2>
      <p className="floor-progress">Rooms cleared: {map.rooms.filter((room) => room.state === 'cleared').length} of {map.rooms.length}</p>
      {view.picks.length > 0 && (
        <ul className="run-picks" aria-label="Picks this Run">
          {view.picks.map((pick, index) => (
            <li key={index} title={pick.line}>
              {pick.placeholder && '[placeholder] '}
              {pick.name}: {pick.line}
            </li>
          ))}
        </ul>
      )}
      <ol className="room-grid" style={style}>
        {map.rooms.map((room, index) => (
          <RoomCell key={`${room.x},${room.y}`} room={room} order={index + 1} column={room.x - left + 1} row={room.y - top + 1} />
        ))}
      </ol>
    </section>
  );
}
