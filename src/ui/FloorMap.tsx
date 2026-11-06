import type { GameView, RoomKind, RoomView } from '../sim';

const ROOM_GLYPHS: Readonly<Record<RoomKind, string>> = { battle: '⚔', chest: '▣', stairs: '▼', guardian: '☠' };
const ROOM_NAMES: Readonly<Record<RoomKind, string>> = { battle: 'Battle', chest: 'Chest', stairs: 'Stairs', guardian: 'Guardian' };

function Tile({ room, order }: { room: RoomView; order: number }) {
  const party = room.state === 'current';
  const label = `Room ${order}: ${ROOM_NAMES[room.kind]}, ${room.state}${party ? ', the Party is here' : ''}`;
  return (
    <li className={`room room-${room.state}`} style={{ gridColumn: room.x + 1, gridRow: room.y + 1 }} aria-label={label} title={label}>
      {party ? '✦' : ROOM_GLYPHS[room.kind]}
    </li>
  );
}

/** The DOM tile map. ADR 0003 keeps it behind this one component. */
export function FloorMap({ view }: { view: GameView }) {
  const { map, floor } = view;
  if (!map) return null;
  const style = { gridTemplateColumns: `repeat(${map.width}, 1fr)`, gridTemplateRows: `repeat(${map.height}, 1fr)` };
  return (
    <section className="panel floor-map" aria-label="Floor map">
      <h2>Floor {floor}</h2>
      <ol className="room-grid" style={style}>
        {map.rooms.map((room, index) => (
          <Tile key={`${room.x},${room.y}`} room={room} order={index + 1} />
        ))}
      </ol>
    </section>
  );
}
