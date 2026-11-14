import { useState } from 'react';
import { SLOTS, type GameView, type HeroView, type ItemView, type Slot } from '../sim';
import { REFUSAL_TEXT } from './describeHero';
import { itemStatsText, SLOT_TEXT } from './describeItem';
import { floorLabel } from './floorLabel';
import { RerollControl } from './RerollControl';
import type { Dispatch } from './store';

/** Items worn by Heroes that have an Affix to reroll. */
const rerollable = (heroes: readonly HeroView[]): { hero: HeroView; slot: Slot; item: ItemView }[] =>
  heroes.flatMap((hero) => SLOTS.flatMap((slot) => {
    const item = hero.equipment[slot];
    return item && item.rerollCost !== null ? [{ hero, slot, item }] : [];
  }));

/** Town's shops. Town is a menu, so they're open whether or not the Party is there. */
export function TownTab({ view, dispatch }: { view: GameView; dispatch: Dispatch }) {
  const [message, setMessage] = useState('');
  const { gold, salvage, town } = view;
  const act = (action: Parameters<Dispatch>[0], done: string) => {
    const result = dispatch(action);
    setMessage(result.ok ? done : REFUSAL_TEXT[result.reason]);
  };
  const worn = rerollable(view.heroes);

  return (
    <main className="town-screen">
      <p className="town-purse">
        <strong>{gold.toLocaleString()} gold</strong> · <strong>{salvage} Salvage</strong> · {view.wall.lampsLit > 0 ? `Goods come from ${floorLabel(town.shopDepth)}, the deepest relit Lamp.` : 'Goods come from the first Floor until a Lamp is relit.'}
      </p>
      {message && <p role="status" className="town-message">{message}</p>}
      <div className="town-shops">
        <section className="panel" aria-label="Merchant">
          <h2>Merchant</h2>
          <p className="hint">New stock each time the Party passes through Town.</p>
          {town.merchant.length === 0 ? (
            <p className="hint">Sold out until the Party next passes through Town.</p>
          ) : (
            <ul className="town-stock">
              {town.merchant.map(({ item, price }, index) => (
                <li key={item.id} className="town-offer">
                  <div>
                    <span className={`rarity-${item.rarity}`}>{item.name}</span>
                    <span className="hint"> {SLOT_TEXT[item.slot]} · Level {item.levelRequirement}</span>
                    <p className="hint">{itemStatsText(item.stats)}</p>
                  </div>
                  <button type="button" disabled={gold < price} aria-label={`Buy ${item.name} for ${price} gold`} onClick={() => act({ type: 'buyItem', index }, `Bought ${item.name}. It waits in the Stash.`)}>
                    {price.toLocaleString()} gold
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel" aria-label="Gamble vendor">
          <h2>Gamble vendor</h2>
          <p className="hint">A hidden item for the Slot you pick, for {town.gamblePrice.toLocaleString()} gold. Mostly magic, often rare, now and then a unique.</p>
          <div className="town-gamble">
            {SLOTS.filter((slot) => slot !== 'secondTrinket').map((slot) => (
              <button key={slot} type="button" disabled={gold < town.gamblePrice} onClick={() => act({ type: 'gamble', slot }, `Gambled on a ${SLOT_TEXT[slot].toLowerCase()}. It waits in the Stash.`)}>
                {SLOT_TEXT[slot]}
              </button>
            ))}
          </div>
        </section>
        <section className="panel" aria-label="Rerolls">
          <h2>Rerolls</h2>
          <p className="hint">Salvage changes one Affix into another the item lacks, at the item's own depth. Stash items reroll from the Stash.</p>
          {worn.length === 0 ? (
            <p className="hint">No worn item has an Affix to reroll.</p>
          ) : (
            <ul className="town-stock">
              {worn.map(({ hero, slot, item }) => (
                <li key={item.id}>
                  <span className="hint">{hero.name}, {SLOT_TEXT[slot].toLowerCase()}: </span>
                  <span className={`rarity-${item.rarity}`}>{item.name}</span>
                  <RerollControl item={item} salvage={salvage} onReroll={(affixId) => act({ type: 'rerollAffix', itemId: item.id, affixId }, `Rerolled ${item.name}.`)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
