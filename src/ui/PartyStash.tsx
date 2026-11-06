import { useMemo, useState } from 'react';
import { itemBlocksLearnedSkill, RARITIES, SLOTS, type HeroView, type ItemStat, type ItemView, type Rarity, type Slot } from '../sim';
import { REFUSAL_TEXT } from './describeHero';
import { changedStats, formatChange, SLOT_TEXT, STAT_TEXT, statChange } from './describeItem';
import { groupItems, openingSlot, queryStash, type ItemGroup, type StashQuery, type StashSort } from './stashQuery';
import type { Dispatch } from './store';

/** Stand-ins until there is item art, drawn as 8 x 8 pixels to match the Battle scene. */
const SLOT_ICONS: Readonly<Record<Slot, readonly string[]>> = {
  weapon: ['00000011', '00000110', '00001100', '00011000', '10110000', '01100000', '01010000', '10001000'],
  body: ['01100110', '11111111', '11111111', '01111110', '01111110', '01111110', '01111110', '01111110'],
  trinket: ['00111100', '01000010', '01000010', '00111100', '00011000', '00111100', '01111110', '00111100'],
};

const SORTS: readonly (readonly [StashSort, string])[] = [['rarity', 'Rarity'], ['newest', 'Newest'], ['levelRequirement', 'Level']];

function SlotIcon({ slot, rarity }: { slot: Slot; rarity: Rarity | null }) {
  return (
    <svg className={`slot-icon slot-icon-${rarity ?? 'empty'}`} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      {SLOT_ICONS[slot].flatMap((row, y) => [...row].map((pixel, x) => (pixel === '1' ? <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" /> : null)))}
    </svg>
  );
}

function StatChanges({ item, hero }: { item: ItemView; hero: HeroView }) {
  const stats = changedStats(item, [hero]);
  if (stats.length === 0) return <span className="hint stat-changes">No change</span>;
  // An empty Slot gains everything, so colour would make every item look like a clear win.
  const emptySlot = !hero.equipment[item.slot];
  return (
    <span className="stat-changes">
      {stats.map((stat) => {
        const change = statChange(item, hero, stat);
        return (
          <span key={stat} className={emptySlot ? undefined : change > 0 ? 'stat-gain' : 'stat-loss'}>
            {formatChange(stat, change)} {STAT_TEXT[stat]}
          </span>
        );
      })}
    </span>
  );
}

function EquipControl({ item, hero, onEquip }: { item: ItemView; hero: HeroView; onEquip: (item: ItemView, hero: HeroView) => void }) {
  if (hero.level < item.levelRequirement) return <span className="hint needs-level">Needs level {item.levelRequirement}</span>;
  return (
    <button type="button" aria-label={`Equip ${item.name} on ${hero.name}`} onClick={() => onEquip(item, hero)}>
      Equip
    </button>
  );
}

interface HeroGearProps {
  readonly hero: HeroView;
  readonly active: boolean;
  readonly activeSlot: Slot;
  readonly onPick: (slot: Slot) => void;
  readonly onUnequip: (slot: Slot) => void;
}

function HeroGear({ hero, active, activeSlot, onPick, onUnequip }: HeroGearProps) {
  const { maxHealth, power, armour, critChance, poisonResistance } = hero.stats;
  return (
    <section className={active ? 'hero-gear hero-gear-active' : 'hero-gear'} aria-label={`Gear of ${hero.name}`}>
      <h3>{hero.name}: level {hero.level}</h3>
      <p className="hint">Health {maxHealth} · Power {power} · Armour {armour} · Crit {critChance}% · Poison {poisonResistance}%</p>
      <ul>
        {SLOTS.map((slot) => {
          const worn = hero.equipment[slot];
          return (
            <li key={slot} className="hero-slot">
              <button
                type="button"
                className="hero-slot-pick"
                aria-label={`${hero.name}'s ${SLOT_TEXT[slot].toLowerCase()}: ${worn?.name ?? 'empty'}`}
                aria-pressed={active && activeSlot === slot}
                onClick={() => onPick(slot)}
              >
                <SlotIcon slot={slot} rarity={worn?.rarity ?? null} />
                {worn ? <span className={`rarity-${worn.rarity}`}>{worn.name}</span> : <span className="hint">Empty {SLOT_TEXT[slot].toLowerCase()}</span>}
              </button>
              {worn && (
                <button type="button" className="hero-slot-unequip" aria-label={`Unequip ${worn.name} from ${hero.name}`} title="Unequip" onClick={() => onUnequip(slot)}>
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface PartyCompareProps {
  readonly group: ItemGroup;
  readonly heroes: readonly HeroView[];
  readonly activeHero: HeroView;
  readonly onEquip: (item: ItemView, hero: HeroView) => void;
}

/** A group's stat changes for each Hero. It never says which Hero or item is better. */
function PartyCompare({ group, heroes, activeHero, onEquip }: PartyCompareProps) {
  const { item, count, highestLevel } = group;
  const levels = highestLevel > item.levelRequirement ? `Levels ${item.levelRequirement}–${highestLevel}` : `Level ${item.levelRequirement}`;
  return (
    <section className="party-compare" aria-label="Compare across the Party">
      <h3 className={`rarity-${item.rarity}`}>
        {item.name}
        {count > 1 && <span className="hint"> ×{count}</span>}
      </h3>
      <p className="hint">{SLOT_TEXT[item.slot]}{item.reach ? ` (${item.reach})` : ''} · {levels}</p>
      {heroes.map((hero) => (
        <div key={hero.id} className={hero.id === activeHero.id ? 'party-member party-member-active' : 'party-member'}>
          <div className="party-member-head">
            <span className="party-member-name">{hero.name}</span>
            <EquipControl item={item} hero={hero} onEquip={onEquip} />
          </div>
          <p className="hint">Replaces {hero.equipment[item.slot]?.name ?? 'nothing'}</p>
          <StatChanges item={item} hero={hero} />
          {itemBlocksLearnedSkill(item, hero) && <p className="hint skill-blocked">Melee skills stop working</p>}
        </div>
      ))}
    </section>
  );
}

export interface PartyStashProps {
  readonly stash: readonly ItemView[];
  readonly heroes: readonly HeroView[];
  readonly dispatch: Dispatch;
  /** Items after this one are marked new. */
  readonly seenItemId: number;
  /** The filters to open with, such as the stat a Finding points to. */
  readonly initial: StashQuery;
}

/** The Party's gear, with the Stash for whichever Slot is picked and that item's changes for the whole Party. */
export function PartyStash({ stash, heroes, dispatch, seenItemId, initial }: PartyStashProps) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [slot, setSlot] = useState<Slot>(() => openingSlot(stash, initial));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sort, setSort] = useState<StashSort>(initial.sort);
  const [rarity, setRarity] = useState<Rarity | 'all'>(initial.rarity);
  const [stat, setStat] = useState<ItemStat | 'all'>(initial.stat);
  const [refusal, setRefusal] = useState('');

  const groups = useMemo(() => groupItems(queryStash(stash, { sort, slot, rarity, stat })), [stash, sort, slot, rarity, stat]);
  const hero = heroes[heroIndex] ?? heroes[0];
  if (!hero) return null;
  const selected = groups.find((group) => group.key === selectedKey) ?? groups[0] ?? null;
  const filtered = rarity !== 'all' || stat !== 'all';
  const slotName = SLOT_TEXT[slot].toLowerCase();

  const equip = (item: ItemView, target: HeroView) => {
    const result = dispatch({ type: 'equipItem', heroId: target.id, itemId: item.id });
    setRefusal(result.ok ? '' : REFUSAL_TEXT[result.reason]);
  };
  const unequip = (target: HeroView, from: Slot) => {
    const result = dispatch({ type: 'unequipItem', heroId: target.id, slot: from });
    setRefusal(result.ok ? '' : REFUSAL_TEXT[result.reason]);
  };
  const clearFilters = () => {
    setRarity('all');
    setStat('all');
  };

  return (
    <div className="party-stash">
      <div className="party-gear">
        {heroes.map((candidate, index) => (
          <HeroGear
            key={candidate.id}
            hero={candidate}
            active={index === heroIndex}
            activeSlot={slot}
            onPick={(picked) => {
              setHeroIndex(index);
              setSlot(picked);
              setSelectedKey(null);
            }}
            onUnequip={(from) => unequip(candidate, from)}
          />
        ))}
      </div>
      {refusal && <p role="alert" className="refusal">{refusal}</p>}
      <div className="stash-lower">
        <section className="stash-list" aria-label="Stash">
          <div className="stash-list-head">
            <h2>{SLOT_TEXT[slot]} items for {hero.name}</h2>
            <span className="hint">{stash.length} of 300 in the Stash</span>
            <div className="stash-controls">
              {SORTS.map(([id, label]) => (
                <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)}>{label}</button>
              ))}
              <select aria-label="Rarity" value={rarity} onChange={(event) => setRarity(event.target.value as Rarity | 'all')}>
                <option value="all">Any rarity</option>
                {RARITIES.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <select aria-label="Has stat" value={stat} onChange={(event) => setStat(event.target.value as ItemStat | 'all')}>
                <option value="all">Any stat</option>
                {(Object.keys(STAT_TEXT) as ItemStat[]).map((id) => <option key={id} value={id}>{STAT_TEXT[id]}</option>)}
              </select>
              {filtered && <button type="button" onClick={clearFilters}>Clear</button>}
            </div>
          </div>
          {groups.length === 0 ? (
            <p className="hint stash-empty">
              {filtered ? `No ${slotName} items match these filters.` : `No ${slotName} items yet. Loot lands here as the Party finds it.`}
            </p>
          ) : (
            <ul className="stash-rows">
              {groups.map((group) => {
                const { item, count, key, newestId } = group;
                const isSelected = selected?.key === key;
                return (
                  <li key={key} className={isSelected ? 'stash-row stash-row-selected' : 'stash-row'}>
                    <button type="button" className="stash-row-pick" aria-pressed={isSelected} onClick={() => setSelectedKey(key)}>
                      <SlotIcon slot={item.slot} rarity={item.rarity} />
                      <span className={`rarity-${item.rarity}`}>{item.name}</span>
                      {count > 1 && <span className="hint">×{count}</span>}
                      {newestId > seenItemId && <span className="stash-new">new</span>}
                      <StatChanges item={item} hero={hero} />
                    </button>
                    <EquipControl item={item} hero={hero} onEquip={equip} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {selected && <PartyCompare group={selected} heroes={heroes} activeHero={hero} onEquip={equip} />}
      </div>
    </div>
  );
}
