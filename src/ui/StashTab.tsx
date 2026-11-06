import { useMemo, useState } from 'react';
import { AFFIXES, RARITIES, SLOTS, type ActionResult, type HeroView, type ItemStat, type ItemView, type Rarity, type Slot } from '../sim';
import { REFUSAL_TEXT } from './describeHero';
import { itemFacts, itemStatsText, SLOT_TEXT, STAT_TEXT, statSheet } from './describeItem';
import { queryStash, type StashQuery, type StashSort } from './stashQuery';
import type { Dispatch } from './store';

const SORT_TEXT: Readonly<Record<StashSort, string>> = { newest: 'Newest', rarity: 'Rarity', levelRequirement: 'Level requirement' };

function ItemName({ item }: { item: ItemView }) {
  return <strong className={`rarity-${item.rarity}`}>{item.name}</strong>;
}

function StashRow({ item, heroes, onEquip }: { item: ItemView; heroes: readonly HeroView[]; onEquip: (hero: HeroView, item: ItemView) => void }) {
  return (
    <li className="stash-item">
      <ItemName item={item} /> <span className="hint">{item.rarity}</span>
      <p className="hint">{itemFacts(item)}</p>
      <p>{itemStatsText(item.stats)}</p>
      <div className="equip-buttons">
        <span className="hint">Equip on</span>
        {heroes.map((hero) => (
          <button
            key={hero.id}
            type="button"
            aria-label={`Equip ${item.name} on ${hero.name}`}
            disabled={hero.level < item.levelRequirement}
            title={hero.level < item.levelRequirement ? `${hero.name} is level ${hero.level}` : undefined}
            onClick={() => onEquip(hero, item)}
          >
            {hero.name}
          </button>
        ))}
      </div>
    </li>
  );
}

function EquippedSlot({ hero, slot, onUnequip }: { hero: HeroView; slot: Slot; onUnequip: (hero: HeroView, slot: Slot) => void }) {
  const item = hero.equipment[slot];
  return (
    <li className="equipped-slot">
      <span className="hint">{SLOT_TEXT[slot]}</span>
      {item ? (
        <>
          <div className="equipped-name">
            <ItemName item={item} />
            <button type="button" aria-label={`Unequip ${item.name} from ${hero.name}`} onClick={() => onUnequip(hero, slot)}>
              Unequip
            </button>
          </div>
          <p className="hint">{itemFacts(item)}</p>
          <p>{itemStatsText(item.stats)}</p>
        </>
      ) : (
        <p className="hint">Empty{slot === 'weapon' ? ': fights in melee' : ''}</p>
      )}
    </li>
  );
}

export function StashTab({ stash, heroes, dispatch }: { stash: readonly ItemView[]; heroes: readonly HeroView[]; dispatch: Dispatch }) {
  const [query, setQuery] = useState<StashQuery>({ sort: 'newest', slot: 'all', rarity: 'all', stat: 'all' });
  const [refusal, setRefusal] = useState('');
  const shown = useMemo(() => queryStash(stash, query), [stash, query]);

  const report = (result: ActionResult) => setRefusal(result.ok ? '' : REFUSAL_TEXT[result.reason]);
  const equip = (hero: HeroView, item: ItemView) => report(dispatch({ type: 'equipItem', heroId: hero.id, itemId: item.id }));
  const unequip = (hero: HeroView, slot: Slot) => report(dispatch({ type: 'unequipItem', heroId: hero.id, slot }));

  return (
    <main className="stash">
      <section className="panel stash-list" aria-label="Stash">
        <h2>Stash ({stash.length})</h2>
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
        {refusal && <p role="alert" className="refusal">{refusal}</p>}
        {shown.length === 0 ? (
          <p className="hint">{stash.length === 0 ? 'Empty. Loot lands here as the Party finds it.' : 'Nothing matches.'}</p>
        ) : (
          <ul className="stash-items">
            {shown.map((item) => (
              <StashRow key={item.id} item={item} heroes={heroes} onEquip={equip} />
            ))}
          </ul>
        )}
      </section>
      <div className="equipped-heroes">
        {heroes.map((hero) => (
          <section key={hero.id} className="panel equipped-hero" aria-label={`Gear of ${hero.name}`}>
            <h3>{hero.name}: level {hero.level}</h3>
            <p className="hint">{statSheet(hero.stats)}</p>
            <ul className="equipped-slots">
              {SLOTS.map((slot) => (
                <EquippedSlot key={slot} hero={hero} slot={slot} onUnequip={unequip} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
