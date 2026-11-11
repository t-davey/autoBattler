import { OFFERS_PER_PICK, type PickTag } from '../sim';
import { describeTag, TAG_TEXT } from './describePicks';
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
      <p>
        Twice each Run, the Party is offered {OFFERS_PER_PICK} Picks and keeps one: once as it sets out from Town, and again before the
        Guardian. A Pick lasts until the Party returns to Town.
      </p>
      <p className="hint">
        The Party keeps the offer whose tag sits highest in this list. A Pick with two tags counts by its higher one. Move a tag up to favour it.
        Changes apply from the next Pick.
      </p>
      <ol className="pick-tags">
        {priority.map((tag, index) => (
          <li key={tag}>
            <span className="pick-rank">{index + 1}</span>
            <div className="pick-tag">
              <strong>{TAG_TEXT[tag]}</strong>
              {describeTag(tag).map((line) => (
                <span key={line} className="hint">{line}</span>
              ))}
            </div>
            <button type="button" aria-label={`Move ${TAG_TEXT[tag]} up`} disabled={index === 0} onClick={() => move(index, -1)}>
              ↑
            </button>
            <button type="button" aria-label={`Move ${TAG_TEXT[tag]} down`} disabled={index === priority.length - 1} onClick={() => move(index, 1)}>
              ↓
            </button>
          </li>
        ))}
      </ol>
      <p className="hint">[placeholder] Every Pick is a stand-in: names and numbers will change.</p>
    </section>
  );
}
