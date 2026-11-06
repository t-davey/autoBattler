import { useState, type FormEvent } from 'react';
import { SLOTS, type HeroView, type SkillId } from '../sim';
import { lockText, REFUSAL_TEXT, skillFacts, skillValues } from './describeHero';
import { SLOT_TEXT, statSheet } from './describeItem';
import type { Dispatch } from './store';

function NameEditor({ hero, dispatch, onRefused }: { hero: HeroView; dispatch: Dispatch; onRefused: (text: string) => void }) {
  const [draft, setDraft] = useState(hero.name);
  const save = (event: FormEvent) => {
    event.preventDefault();
    const result = dispatch({ type: 'renameHero', heroId: hero.id, name: draft });
    onRefused(result.ok ? '' : REFUSAL_TEXT[result.reason]);
    if (result.ok) setDraft(draft.trim());
  };
  return (
    <form className="name-editor" onSubmit={save}>
      <input aria-label={`Name of ${hero.name}`} value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button type="submit" disabled={draft.trim() === hero.name}>
        Rename
      </button>
    </form>
  );
}

function SkillOrder({ hero, dispatch, nameOf }: { hero: HeroView; dispatch: Dispatch; nameOf: (id: SkillId) => string }) {
  const move = (index: number, by: number) => {
    const order = [...hero.order];
    const [skill] = order.splice(index, 1);
    if (!skill) return;
    order.splice(index + by, 0, skill);
    dispatch({ type: 'setSkillOrder', heroId: hero.id, order });
  };
  if (hero.order.length === 0) return <p className="hint">No active skills learned. This Hero uses only the basic attack.</p>;
  return (
    <ol className="skill-order" aria-label={`Skill order of ${hero.name}`}>
      {hero.order.map((id, index) => (
        <li key={id}>
          <span>{nameOf(id)}</span>
          <button type="button" aria-label={`Move ${nameOf(id)} up`} disabled={index === 0} onClick={() => move(index, -1)}>
            ↑
          </button>
          <button type="button" aria-label={`Move ${nameOf(id)} down`} disabled={index === hero.order.length - 1} onClick={() => move(index, 1)}>
            ↓
          </button>
        </li>
      ))}
      <li className="hint">then the basic attack</li>
    </ol>
  );
}

function HeroCard({ hero, dispatch }: { hero: HeroView; dispatch: Dispatch }) {
  const [refusal, setRefusal] = useState('');
  const nameOf = (id: SkillId) => hero.skills.find((skill) => skill.id === id)?.name ?? id;

  return (
    <section className="panel hero-card" aria-label={hero.name}>
      <NameEditor hero={hero} dispatch={dispatch} onRefused={setRefusal} />
      {refusal && <p role="alert" className="refusal">{refusal}</p>}
      <p className="hero-level">
        Level {hero.level} · {hero.xp} / {hero.xpToNext} XP · Oil {Math.floor(hero.oil)} / {hero.stats.maxOil}
      </p>
      <p className="hint">{statSheet(hero.stats)}</p>
      <ul className="planning-gear" aria-label={`${hero.name}'s gear`}>
        {SLOTS.map((slot) => {
          const item = hero.equipment[slot];
          return (
            <li key={slot} className="hint">
              {SLOT_TEXT[slot]}: {item ? <span className={`rarity-${item.rarity}`}>{item.name}</span> : 'empty'}
            </li>
          );
        })}
      </ul>

      <h3>{hero.skills[0]?.branch}: {hero.unspentPoints} unspent</h3>
      <ul className="skills">
        {hero.skills.map((skill) => {
          const locked = lockText(skill);
          return (
            <li key={skill.id} className={skill.rank > 0 ? 'skill' : 'skill skill-unlearned'}>
              <div className="skill-head">
                <strong>{skill.name}</strong>
                <span>Rank {skill.rank} / {skill.maxRank}</span>
                <button
                  type="button"
                  aria-label={`Spend a point on ${skill.name}`}
                  disabled={skill.refusal !== null}
                  onClick={() => dispatch({ type: 'spendSkillPoint', heroId: hero.id, skillId: skill.id })}
                >
                  +
                </button>
              </div>
              <p className="hint">{skillFacts(skill)}</p>
              <p>{skill.summary}</p>
              {skillValues(skill).map((line) => (
                <p key={line} className="hint">{line}</p>
              ))}
              {locked && <p className="hint">{locked}</p>}
              {skill.blockedByWeapon && <p className="hint skill-blocked">Needs a melee weapon: unavailable while holding a ranged one.</p>}
            </li>
          );
        })}
      </ul>

      <h3>Skill order</h3>
      <SkillOrder hero={hero} dispatch={dispatch} nameOf={nameOf} />

      <button type="button" className="respec" disabled={hero.pointsSpent === 0} onClick={() => dispatch({ type: 'respec', heroId: hero.id })}>
        Respec (free)
      </button>
    </section>
  );
}

export function PlanningTab({ heroes, dispatch }: { heroes: readonly HeroView[]; dispatch: Dispatch }) {
  return (
    <>
      <p className="hint">Changes reach the Party at the start of its next Battle.</p>
      <div className="hero-cards">
        {heroes.map((hero) => (
          <HeroCard key={hero.id} hero={hero} dispatch={dispatch} />
        ))}
      </div>
    </>
  );
}
