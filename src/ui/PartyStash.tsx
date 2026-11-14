import { useMemo, useState } from 'react';
import { itemBlocksLearnedSkill, RARITIES, SLOTS, type HeroView, type ItemStat, type ItemView, type Rarity, type Slot } from '../sim';
import { REFUSAL_TEXT } from './describeHero';
import { changedStats, formatChange, itemStatsText, SLOT_TEXT, STAT_TEXT, statChange, targetSlot } from './describeItem';
import { PixelIcon } from './PixelIcon';
import { groupItems, openingSlot, queryStash, type ItemGroup, type StashQuery, type StashSort } from './stashQuery';
import type { Dispatch } from './store';

const SORTS: readonly (readonly [StashSort, string])[] = [['rarity', 'Rarity'], ['newest', 'Newest'], ['levelRequirement', 'Level']];

function SlotIcon({ slot, rarity }: { slot: Slot; rarity: Rarity | null }) {
  return <PixelIcon name={slot} className={`slot-icon slot-icon-${rarity ?? 'empty'}`} />;
}

function StatChanges({ item, hero, picked }: { item: ItemView; hero: HeroView; picked: Slot }) {
  const slot = targetSlot(item, hero, picked);
  const stats = changedStats(item, [hero], picked);
  if (stats.length === 0) return <span className="hint stat-changes">No change</span>;
  // An empty Slot gains everything, so colour would make every item look like a clear win.
  const emptySlot = !hero.equipment[slot];
  return (
    <span className="stat-changes">
      {stats.map((stat) => {
        const change = statChange(item, hero, stat, slot);
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
  if (item.unique && item.unique.classId !== hero.classId) return <span className="hint needs-level">{item.unique.className} only</span>;
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
  const { maxHealth, power, armour, critChance, poisonResistance, maxOil } = hero.stats;
  return (
    <section className={active ? 'hero-gear hero-gear-active' : 'hero-gear'} aria-label={`Gear of ${hero.name}`}>
      <h3>{hero.name}, {hero.className}: level {hero.level}</h3>
      <p className="hint">Health {maxHealth} · Power {power} · Armour {armour} · Crit {critChance}% · Poison resistance {poisonResistance}% · Oil {maxOil}</p>
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
  readonly picked: Slot;
  readonly onEquip: (item: ItemView, hero: HeroView) => void;
}

/** A group's stat changes for each Hero. It never says which Hero or item is better. */
function PartyCompare({ group, heroes, activeHero, picked, onEquip }: PartyCompareProps) {
  const { item, count, highestLevel } = group;
  const levels = highestLevel > item.levelRequirement ? `Levels ${item.levelRequirement}–${highestLevel}` : `Level ${item.levelRequirement}`;
  return (
    <section className="party-compare" aria-label="Compare across the Party">
      <h3 className={`rarity-${item.rarity}`}>
        {item.name}
        {count > 1 && <span className="hint"> ×{count}</span>}
      </h3>
      <p className="hint">{SLOT_TEXT[item.slot]}{item.reach ? ` (${item.reach})` : ''} · {levels}</p>
      <p className="compare-stats">{itemStatsText(item.stats)}</p>
      {item.unique && (
        <>
          <p className="compare-unique">{item.unique.className} only. {item.unique.change}</p>
          <p className="hint item-line">{item.unique.line}</p>
        </>
      )}
      {heroes.map((hero) => (
        <div key={hero.id} className={hero.id === activeHero.id ? 'compare-hero compare-hero-active' : 'compare-hero'}>
          <div className="compare-hero-head">
            <span className="compare-hero-name">{hero.name}</span>
            <EquipControl item={item} hero={hero} onEquip={onEquip} />
          </div>
          <p className="hint">Replaces {hero.equipment[targetSlot(item, hero, picked)]?.name ?? 'nothing'}</p>
          <StatChanges item={item} hero={hero} picked={picked} />
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
    const result = dispatch({ type: 'equipItem', heroId: target.id, itemId: item.id, slot: targetSlot(item, target, slot) });
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
            <span className="hint">{stash.length} in the Stash</span>
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
                      <StatChanges item={item} hero={hero} picked={slot} />
                      {itemBlocksLearnedSkill(item, hero) && <span className="hint skill-blocked stash-row-warning">Melee skills stop working</span>}
                    </button>
                    <EquipControl item={item} hero={hero} onEquip={equip} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {selected && <PartyCompare group={selected} heroes={heroes} activeHero={hero} picked={slot} onEquip={equip} />}
      </div>
    </div>
  );
}
