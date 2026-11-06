import { useMemo, useState } from 'react';
import { AFFIXES, RARITIES, SLOTS, type HeroView, type ItemStat, type ItemView, type Rarity, type Slot } from '../sim';
import { REFUSAL_TEXT } from './describeHero';
import { changedStats, formatChange, itemFacts, itemStatsText, losesMeleeSkills, SLOT_TEXT, STAT_TEXT, statChange } from './describeItem';
import { queryStash, type StashQuery, type StashSort } from './stashQuery';
import type { Dispatch } from './store';

const SORT_TEXT: Readonly<Record<StashSort, string>> = { newest: 'Newest', rarity: 'Rarity', levelRequirement: 'Level requirement' };

export interface StashPickerProps {
  readonly stash: readonly ItemView[];
  readonly initial: StashQuery;
  readonly selectedId: number | null;
  readonly onSelect: (id: number) => void;
}

/** The Stash's controls and list. Picking an item shows it in ItemCompare. */
export function StashPicker({ stash, initial, selectedId, onSelect }: StashPickerProps) {
  const [query, setQuery] = useState<StashQuery>(initial);
  const shown = useMemo(() => queryStash(stash, query), [stash, query]);
  return (
    <>
      <div className="stash-controls">
        <label>
          Sort
          <select value={query.sort} onChange={(event) => setQuery({ ...query, sort: event.target.value as StashSort })}>
            {(Object.keys(SORT_TEXT) as StashSort[]).map((sort) => (
              <option key={sort} value={sort}>{SORT_TEXT[sort]}</option>
            ))}
          </select>
        </label>
        <label>
          Slot
          <select value={query.slot} onChange={(event) => setQuery({ ...query, slot: event.target.value as Slot | 'all' })}>
            <option value="all">All</option>
            {SLOTS.map((slot) => (
              <option key={slot} value={slot}>{SLOT_TEXT[slot]}</option>
            ))}
          </select>
        </label>
        <label>
          Rarity
          <select value={query.rarity} onChange={(event) => setQuery({ ...query, rarity: event.target.value as Rarity | 'all' })}>
            <option value="all">All</option>
            {RARITIES.map((rarity) => (
              <option key={rarity} value={rarity}>{rarity}</option>
            ))}
          </select>
        </label>
        <label>
          Stat
          <select value={query.stat} onChange={(event) => setQuery({ ...query, stat: event.target.value as ItemStat | 'all' })}>
            <option value="all">All</option>
            {AFFIXES.map((affix) => (
              <option key={affix.stat} value={affix.stat}>{STAT_TEXT[affix.stat]} ({affix.name})</option>
            ))}
          </select>
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="hint">{stash.length === 0 ? 'Empty. Loot lands here as the Party finds it.' : 'Nothing matches.'}</p>
      ) : (
        <ul className="stash-items">
          {shown.map((item) => (
            <li key={item.id}>
              <button type="button" className="stash-item" aria-pressed={item.id === selectedId} onClick={() => onSelect(item.id)}>
                <span className={`rarity-${item.rarity}`}>{item.name}</span>
                <span className="hint">{itemFacts(item)}</span>
                <span>{itemStatsText(item.stats)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export interface ItemCompareProps {
  readonly item: ItemView | null;
  readonly heroes: readonly HeroView[];
  readonly dispatch: Dispatch;
}

/** An item's stat changes for each Hero. It never says which Hero or item is better. */
export function ItemCompare({ item, heroes, dispatch }: ItemCompareProps) {
  const [refusal, setRefusal] = useState('');
  if (!item) return <p className="hint">Pick an item to see what it changes for each Hero.</p>;
  const equip = (hero: HeroView) => {
    const result = dispatch({ type: 'equipItem', heroId: hero.id, itemId: item.id });
    setRefusal(result.ok ? '' : REFUSAL_TEXT[result.reason]);
  };
  return (
    <div className="item-compare">
      <h3 className={`rarity-${item.rarity}`}>{item.name}</h3>
      <p className="hint">{itemFacts(item)}</p>
      {refusal && <p role="alert" className="refusal">{refusal}</p>}
      <table>
        <thead>
          <tr>
            <th scope="col"><span className="visually-hidden">Stat</span></th>
            {heroes.map((hero) => <th key={hero.id} scope="col">{hero.name}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="hint">
            <th scope="row">Replaces</th>
            {heroes.map((hero) => <td key={hero.id}>{hero.equipment[item.slot]?.name ?? `Empty ${SLOT_TEXT[item.slot].toLowerCase()}`}</td>)}
          </tr>
          {changedStats(item, heroes).map((stat) => (
            <tr key={stat}>
              <th scope="row">{STAT_TEXT[stat]}</th>
              {heroes.map((hero) => {
                const change = statChange(item, hero, stat);
                return <td key={hero.id} className={change > 0 ? 'stat-gain' : change < 0 ? 'stat-loss' : 'hint'}>{formatChange(stat, change)}</td>;
              })}
            </tr>
          ))}
          <tr>
            <th scope="row"><span className="visually-hidden">Equip</span></th>
            {heroes.map((hero) => (
              <td key={hero.id}>
                {hero.level < item.levelRequirement ? (
                  <span className="hint">Needs level {item.levelRequirement}</span>
                ) : (
                  <button type="button" aria-label={`Equip ${item.name} on ${hero.name}`} onClick={() => equip(hero)}>Equip</button>
                )}
                {losesMeleeSkills(item, hero) && <p className="hint skill-blocked">Melee skills stop working</p>}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
