import { useState } from 'react';
import { SLOTS, type HeroView, type ItemView, type Slot } from '../sim';
import { REFUSAL_TEXT } from './describeHero';
import { itemFacts, itemStatsText, SLOT_TEXT, statSheet } from './describeItem';
import { ItemCompare, StashPicker } from './ItemCompare';
import { emptyStashQuery } from './stashQuery';
import type { Dispatch } from './store';

function ItemName({ item }: { item: ItemView }) {
  return <strong className={`rarity-${item.rarity}`}>{item.name}</strong>;
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [refusal, setRefusal] = useState('');
  const selected = stash.find((item) => item.id === selectedId) ?? null;

  const unequip = (hero: HeroView, slot: Slot) => {
    const result = dispatch({ type: 'unequipItem', heroId: hero.id, slot });
    setRefusal(result.ok ? '' : REFUSAL_TEXT[result.reason]);
  };

  return (
    <main className="stash">
      <section className="panel stash-list" aria-label="Stash">
        <h2>Stash ({stash.length})</h2>
        {refusal && <p role="alert" className="refusal">{refusal}</p>}
        <StashPicker stash={stash} initial={emptyStashQuery} selectedId={selectedId} onSelect={setSelectedId} />
      </section>
      <div className="equipped-heroes">
        <section className="panel" aria-label="Compare">
          <ItemCompare key={selected?.id ?? 'none'} item={selected} heroes={heroes} dispatch={dispatch} />
        </section>
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
