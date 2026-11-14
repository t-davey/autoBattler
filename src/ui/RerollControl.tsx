import { AFFIXES, type AffixId, type ItemView } from '../sim';

/** A button for each of the item's Affixes, which rerolls it for Salvage. */
export function RerollControl({ item, salvage, onReroll }: { item: ItemView; salvage: number; onReroll: (affixId: AffixId) => void }) {
  if (item.rerollCost === null) return null;
  const cost = item.rerollCost;
  return (
    <p className="reroll-control">
      <span className="hint">Reroll for {cost} Salvage:</span>{' '}
      {item.affixes.map((id) => {
        const name = AFFIXES.find((affix) => affix.id === id)!.name;
        return (
          <button key={id} type="button" disabled={salvage < cost} aria-label={`Reroll ${name} on ${item.name} for ${cost} Salvage`} onClick={() => onReroll(id)}>
            {name}
          </button>
        );
      })}
    </p>
  );
}
