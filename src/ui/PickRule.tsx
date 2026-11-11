import type { PickTag } from '../sim';
import { TAG_TEXT } from './describePicks';
import type { Dispatch } from './store';

/** The player's Pick rule: the Party takes the offer with the highest tag in this list. */
export function PickRule({ priority, dispatch }: { priority: readonly PickTag[]; dispatch: Dispatch }) {
  const move = (index: number, by: number) => {
    const order = [...priority];
    const [tag] = order.splice(index, 1);
    if (!tag) return;
    order.splice(index + by, 0, tag);
    dispatch({ type: 'setPickPriority', priority: order });
  };
  return (
    <section className="panel pick-rule" aria-label="Pick rule">
      <h3>Pick rule</h3>
      <p className="hint">At each Pick, the Party takes the offer whose tag is highest here. Changes apply from the next Pick.</p>
      <ol className="skill-order">
        {priority.map((tag, index) => (
          <li key={tag}>
            <span>{TAG_TEXT[tag]}</span>
            <button type="button" aria-label={`Move ${TAG_TEXT[tag]} up`} disabled={index === 0} onClick={() => move(index, -1)}>
              ↑
            </button>
            <button type="button" aria-label={`Move ${TAG_TEXT[tag]} down`} disabled={index === priority.length - 1} onClick={() => move(index, 1)}>
              ↓
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
