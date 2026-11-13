import { useState, type FormEvent } from 'react';
import { MAX_ORDERED_SKILLS, SLOTS, type HeroView, type PickTag, type SkillId, type SkillView } from '../sim';
import { PickRule } from './PickRule';
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

/** Up to MAX_ORDERED_SKILLS learned actives, in order. The rest sit out. */
function SkillOrder({ hero, dispatch, nameOf }: { hero: HeroView; dispatch: Dispatch; nameOf: (id: SkillId) => string }) {
  const setOrder = (order: SkillId[]) => dispatch({ type: 'setSkillOrder', heroId: hero.id, order });
  const move = (index: number, by: number) => {
    const order = [...hero.order];
    const [skill] = order.splice(index, 1);
    if (!skill) return;
    order.splice(index + by, 0, skill);
    setOrder(order);
  };
  const full = hero.order.length >= MAX_ORDERED_SKILLS;
  const sittingOut = hero.skills.filter((skill) => skill.kind === 'active' && skill.rank > 0 && !hero.order.includes(skill.id));
  return (
    <>
      {hero.order.length === 0 ? (
        <p className="hint">No active skills in the order. This Hero uses only the basic attack.</p>
      ) : (
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
              <button type="button" aria-label={`Take ${nameOf(id)} out of the order`} onClick={() => setOrder(hero.order.filter((other) => other !== id))}>
                ✕
              </button>
            </li>
          ))}
          <li className="hint">then the basic attack</li>
        </ol>
      )}
      {sittingOut.length > 0 && (
        <ul className="skill-order" aria-label={`Skills ${hero.name} leaves out`}>
          {sittingOut.map((skill) => (
            <li key={skill.id} className="hint">
              <span>{skill.name}, left out</span>
              <button type="button" aria-label={`Add ${skill.name} to the order`} disabled={full} onClick={() => setOrder([...hero.order, skill.id])}>
                Add
              </button>
            </li>
          ))}
          {full && <li className="hint">The order holds {MAX_ORDERED_SKILLS} skills. Take one out to add another.</li>}
        </ul>
      )}
    </>
  );
}

/** The free Class skill first, then each Branch in the order its skills come. */
function branchesOf(skills: readonly SkillView[]): [string, SkillView[]][] {
  const branches = new Map<string, SkillView[]>();
  for (const skill of [...skills].sort((a, b) => Number(b.free) - Number(a.free))) {
    branches.set(skill.branch, [...(branches.get(skill.branch) ?? []), skill]);
  }
  return [...branches];
}

function HeroCard({ hero, dispatch }: { hero: HeroView; dispatch: Dispatch }) {
  const [refusal, setRefusal] = useState('');
  const nameOf = (id: SkillId) => hero.skills.find((skill) => skill.id === id)?.name ?? id;

  return (
    <section className="panel hero-card" aria-label={hero.name}>
      <NameEditor hero={hero} dispatch={dispatch} onRefused={setRefusal} />
      {refusal && <p role="alert" className="refusal">{refusal}</p>}
      <p className="hero-level">
        {hero.className} · Level {hero.level} · {hero.xp} / {hero.xpToNext} XP · Oil {Math.floor(hero.oil)} / {hero.stats.maxOil}
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

      <p className="hint">{hero.unspentPoints} unspent</p>
      {branchesOf(hero.skills).map(([branch, skills]) => (
        <section key={branch} aria-label={branch}>
          <h3>{branch}</h3>
          <ul className="skills">
            {skills.map((skill) => {
              const locked = lockText(skill);
              return (
                <li key={skill.id} className={skill.rank > 0 ? 'skill' : 'skill skill-unlearned'}>
                  <div className="skill-head">
                    <strong>{skill.name}</strong>
                    <span>{skill.free ? 'Class skill, free' : `Rank ${skill.rank} / ${skill.maxRank}`}</span>
                    {!skill.free && <button
                      type="button"
                      aria-label={`Spend a point on ${skill.name}`}
                      disabled={skill.refusal !== null}
                      onClick={() => dispatch({ type: 'spendSkillPoint', heroId: hero.id, skillId: skill.id })}
                    >
                      +
                    </button>}
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
        </section>
      ))}

      <h3>Skill order: {hero.order.length} of {MAX_ORDERED_SKILLS}</h3>
      <SkillOrder hero={hero} dispatch={dispatch} nameOf={nameOf} />

      <button type="button" className="respec" disabled={hero.pointsSpent === 0} onClick={() => dispatch({ type: 'respec', heroId: hero.id })}>
        Respec (free)
      </button>
    </section>
  );
}

export function PlanningTab({ heroes, pickPriority, dispatch }: { heroes: readonly HeroView[]; pickPriority: readonly PickTag[]; dispatch: Dispatch }) {
  return (
    <>
      <p className="hint">Changes reach the Party at the start of its next Battle.</p>
      <PickRule priority={pickPriority} dispatch={dispatch} />
      <div className="hero-cards">
        {heroes.map((hero) => (
          <HeroCard key={hero.id} hero={hero} dispatch={dispatch} />
        ))}
      </div>
    </>
  );
}
