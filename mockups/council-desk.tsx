/* The Council desk: the Away Report, Planning, and the Stash as one screen. A mockup on the real sim.
   Pictures carry the desk: glyphs stand in for stat and Pick names, the scene's own objects are its controls,
   and the words wait on chits and tooltips for whoever hovers. */
import '@fontsource/grenze-gotisch/600.css';
import '@fontsource/grenze-gotisch/800.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/alegreya/400.css';
import '@fontsource/alegreya/400-italic.css';
import '@fontsource/alegreya/700.css';
import '@fontsource/cedarville-cursive/400.css';
import '../src/ui/style.css';
import './ui-art.css';
import './council-desk.css';
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  AFFIXES,
  applyAction,
  beginCatchUp,
  continueCatchUp,
  createGame,
  floorAt,
  LAMPS,
  SLOTS,
  viewGame,
  viewStash,
  type AwayReport,
  type HeroView,
  type ItemStat,
  type ItemView,
  type PickTag,
  type PlayerAction,
  type Rarity,
  type SkillView,
  type Slot,
} from '../src/sim';
import { describeDuration } from '../src/ui/describeAwayReport';
import { describeFindings, type Finding, type FindingKind } from '../src/ui/describeFindings';
import { lockText, REFUSAL_TEXT, seconds, skillFacts, skillValues } from '../src/ui/describeHero';
import { changedStats, formatChange, SLOT_TEXT, STAT_TEXT, statChange } from '../src/ui/describeItem';
import { describeTag, TAG_TEXT } from '../src/ui/describePicks';
import { floorLabel } from '../src/ui/floorLabel';
import { groupItems, queryStash, type StashSort } from '../src/ui/stashQuery';
import { Glyph, RARITY_COLOUR, STAT_GLYPH, TAG_GLYPH, type GlyphName } from './desk-glyphs';
import { artPx, nextFrame, paint } from './painters';
import './desk-painters';

/* ---------- The game: a real one, caught up a few hours so the report, levels, and Stash are genuine. ---------- */

const game = createGame({ seed: 8, scenario: { heroLevel: 4 } });
const catchUp = beginCatchUp(game, 3 * 60 * 60 * 1000);
let report: AwayReport | null = null;
while (!report) report = continueCatchUp(game, catchUp, 20_000);
const REPORT: AwayReport = report;

/* ---------- Painted elements. ---------- */

type PaintedTag = 'div' | 'span' | 'section' | 'button' | 'aside' | 'article' | 'li';

function Painted({ kind, tag = 'div', className = '', data = {}, children, ...rest }: { kind: string; tag?: PaintedTag; className?: string; data?: Record<string, string | number | boolean>; children?: ReactNode } & Record<string, unknown>) {
  const ref = useRef<HTMLElement>(null);
  const key = JSON.stringify(data);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    paint(el);
    const observer = new ResizeObserver(() => paint(el));
    observer.observe(el);
    const repaint = () => paint(el);
    window.addEventListener('repaint', repaint);
    return () => {
      observer.disconnect();
      window.removeEventListener('repaint', repaint);
    };
  }, [kind, key]);
  const Tag = tag as 'div';
  const dataAttributes = Object.fromEntries(Object.entries(data).map(([name, value]) => [`data-${name}`, String(value)]));
  return (
    <Tag ref={ref as React.Ref<HTMLDivElement>} className={`art ${className}`} data-art={kind} {...dataAttributes} {...rest}>
      <canvas />
      {children}
    </Tag>
  );
}

/* ---------- Helpers. ---------- */

const FINDING_GLYPHS: Readonly<Record<FindingKind, GlyphName>> = { setbacks: 'guardian', picks: 'stacking', loot: 'gem', points: 'star' };
const CLASS_TEXT: Readonly<Record<string, string>> = { 'sin-eater': 'Sin-Eater', warrener: 'Warrener', lamplighter: 'Lamplighter' };
const CLASS_GLYPH: Readonly<Record<string, GlyphName>> = { 'sin-eater': 'sinEater', warrener: 'warrener', lamplighter: 'lamplighter' };
const STAT_ROWS: readonly { stat: ItemStat; label: string; value: (hero: HeroView) => string }[] = [
  { stat: 'maxHealth', label: 'Health', value: (hero) => `${Math.round(hero.stats.maxHealth)}` },
  { stat: 'power', label: 'Power', value: (hero) => `${Math.round(hero.stats.power)}` },
  { stat: 'armour', label: 'Armour', value: (hero) => `${Math.round(hero.stats.armour)}` },
  { stat: 'critChance', label: 'Critical chance', value: (hero) => `${hero.stats.critChance}%` },
  { stat: 'poisonResistance', label: 'Poison resistance', value: (hero) => `${Math.round(hero.stats.poisonResistance)}%` },
  { stat: 'speed', label: 'Acts every', value: (hero) => seconds(hero.stats.actionInterval) },
];
const STATS = Object.keys(STAT_TEXT) as ItemStat[];
const RARITIES: readonly Rarity[] = ['common', 'magic', 'rare'];
const number = (value: number) => Math.round(value).toLocaleString('en-GB');
const compact = (value: number) => (value >= 10_000 ? `${Math.round(value / 1000)}k` : number(value));
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const ITEM_TYPE = 'application/x-desk-item';
const WORN_TYPE = 'application/x-desk-worn';

/** The item's base, without the Affix names that its stat glyphs already show: "Bone Sling". */
function baseName(item: ItemView): string {
  const prefix = item.affixes.map((id) => AFFIXES.find((affix) => affix.id === id)?.name ?? '').join(' ');
  return prefix && item.name.startsWith(`${prefix} `) ? item.name.slice(prefix.length + 1) : item.name;
}

/** An item's stats as glyphs with their figures. */
function StatChips({ item }: { item: ItemView }) {
  const stats = STATS.filter((stat) => item.stats[stat] !== 0);
  return (
    <span className="chips">
      {stats.map((stat) => (
        <span key={stat} className="chip" title={`${formatChange(stat, item.stats[stat])} ${STAT_TEXT[stat]}`}>
          <Glyph name={STAT_GLYPH[stat]} />
          {formatChange(stat, item.stats[stat]).replace('+', '')}
        </span>
      ))}
    </span>
  );
}

/** What equipping an item would change on a Hero, as glyphs: gains in verdigris, losses in rust. */
function ChangeChips({ item, hero, limit = 6 }: { item: ItemView; hero: HeroView; limit?: number }) {
  const keys = changedStats(item, [hero]).slice(0, limit);
  if (keys.length === 0) return <span className="chips chip-none" title="No change">·</span>;
  return (
    <span className="chips">
      {keys.map((key) => {
        const change = statChange(item, hero, key);
        return (
          <span key={key} className={change > 0 ? 'chip gain' : 'chip loss'} title={`${formatChange(key, change)} ${STAT_TEXT[key]}`}>
            <Glyph name={STAT_GLYPH[key]} />
            {formatChange(key, change)}
          </span>
        );
      })}
    </span>
  );
}

/** A list the player reorders by dragging, or with the arrow keys on a focused entry. */
function Reorder<T extends string>({ items, label, describe, render, onMove, className, after }: { items: readonly T[]; label: (item: T) => string; describe?: (item: T) => string; render: (item: T, index: number) => ReactNode; onMove: (order: T[]) => void; className?: string; after?: ReactNode }) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const refocus = useRef<T | null>(null);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (refocus.current === null) return;
    list.current?.querySelector<HTMLElement>(`[data-key="${refocus.current}"]`)?.focus();
    refocus.current = null;
  });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const order = [...items];
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item!);
    refocus.current = item!;
    onMove(order);
  };
  const onKey = (index: number) => (event: KeyboardEvent) => {
    if (event.key === 'ArrowUp') move(index, index - 1);
    else if (event.key === 'ArrowDown') move(index, index + 1);
    else return;
    event.preventDefault();
  };
  return (
    <ol ref={list} className={`reorder ${className ?? ''}`}>
      {items.map((item, index) => (
        <li
          key={item}
          data-key={item}
          tabIndex={0}
          draggable
          aria-label={`${index + 1}. ${label(item)}. Arrow keys to move.`}
          title={describe?.(item)}
          className={`${dragging === index ? 'dragging' : ''}${over === index && dragging !== index ? ' drop-here' : ''}`}
          onKeyDown={onKey(index)}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item);
            setDragging(index);
          }}
          onDragEnd={() => {
            setDragging(null);
            setOver(null);
          }}
          onDragOver={(event) => {
            if (dragging === null) return;
            event.preventDefault();
            setOver(index);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragging !== null) move(dragging, index);
            setDragging(null);
            setOver(null);
          }}
        >
          {render(item, index)}
        </li>
      ))}
      {after}
    </ol>
  );
}

/** Drop an item from the strongbox here to equip it on this Hero. */
function equipDrop(hero: HeroView, onEquip: (itemId: number, hero: HeroView) => void) {
  return {
    onDragOver: (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(ITEM_TYPE)) return;
      event.preventDefault();
      (event.currentTarget as HTMLElement).classList.add('drop-target');
    },
    onDragLeave: (event: DragEvent) => (event.currentTarget as HTMLElement).classList.remove('drop-target'),
    onDrop: (event: DragEvent) => {
      (event.currentTarget as HTMLElement).classList.remove('drop-target');
      const id = Number(event.dataTransfer.getData(ITEM_TYPE));
      if (!id) return;
      event.preventDefault();
      onEquip(id, hero);
    },
  };
}

function Bust({ hero, className = '' }: { hero: HeroView; className?: string }) {
  return <Painted kind="portrait" className={`bust ${className}`} data={{ frame: 'bust', hero: hero.id, oil: (hero.oil / hero.stats.maxOil).toFixed(2) }} />;
}

/* ---------- The ledger: the Away Report as a tally, its Findings as slips, and the standing orders. ---------- */

function StandingOrders({ priority, flagged, dispatch }: { priority: readonly PickTag[]; flagged: boolean; dispatch: (action: PlayerAction) => void }) {
  return (
    <section className={flagged ? 'orders flagged' : 'orders'} aria-label="Standing orders: the Party keeps the highest-ranked Pick of the 3 offered">
      <Reorder
        items={priority}
        className="order-slips"
        label={(tag) => TAG_TEXT[tag]}
        describe={(tag) => `${TAG_TEXT[tag]}\n${describeTag(tag).join('\n')}`}
        onMove={(order) => dispatch({ type: 'setPickPriority', priority: order })}
        render={(tag, index) => (
          <>
            <Painted kind="medallion" tag="span" className="order-rank">{index + 1}</Painted>
            <Glyph name={TAG_GLYPH[tag]} className="order-glyph" />
            <span className="order-tag">{TAG_TEXT[tag]}</span>
          </>
        )}
      />
    </section>
  );
}

function Tally({ glyph, label, children, wide }: { glyph: GlyphName; label: string; children: ReactNode; wide?: boolean }) {
  return (
    <p className={wide ? 'tally wide' : 'tally'} title={label}>
      <Glyph name={glyph} label={label} />
      <span>{children}</span>
    </p>
  );
}

function Gems({ common, magic, rare }: { common: number; magic: number; rare: number }) {
  return (
    <span className="gems">
      {([['common', common], ['magic', magic], ['rare', rare]] as const).map(([rarity, count]) => (
        <span key={rarity} className="gem-count" title={`${count} ${rarity}`}>
          <Glyph name="gem" colour={RARITY_COLOUR[rarity]} />
          {count}
        </span>
      ))}
    </span>
  );
}

interface LedgerProps {
  readonly findings: readonly Finding[];
  readonly focus: FindingKind | null;
  readonly onFocus: (kind: FindingKind | null) => void;
  readonly priority: readonly PickTag[];
  readonly lampsLit: number;
  readonly dispatch: (action: PlayerAction) => void;
}

function Ledger({ findings, focus, onFocus, priority, lampsLit, dispatch }: LedgerProps) {
  const { loot } = REPORT;
  const [phase, setPhase] = useState(0);
  /** Opening the valve sends the Party: the wheel turns, oil runs through the glass, and the lantern takes. */
  const send = () => {
    if (phase > 0) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let step = reduced ? 7 : 0;
    const timer = setInterval(() => {
      step += 1;
      setPhase(step);
      if (step < 8) return;
      clearInterval(timer);
      setTimeout(() => setPhase(0), 1100);
    }, 110);
  };
  const deepest = REPORT.deepestFloor > 0 ? floorAt(REPORT.deepestFloor) : null;
  return (
    <Painted kind="ledger" tag="section" className="ledger" data={{ lit: phase > 0 }} aria-label="Away Report">
      <button type="button" className={phase > 0 ? 'lantern-works open' : 'lantern-works'} aria-label="Open the valve: light the lantern and send the Party back" title="Open the valve: light the lantern and send the Party back" onClick={send}>
        <Painted kind="lanternWorks" tag="span" className="works-art" data={{ phase, density: 2 }} />
      </button>
      <div className="ledger-page">
        <div className="ledger-head">
          <Painted kind="seal" className="seal" title={REPORT.capped ? `Only ${describeDuration(REPORT.appliedMs)} of it counted` : undefined}>
            <span>{describeDuration(REPORT.elapsedMs)}</span>
          </Painted>
          <h2 className="sr-only">Away Report</h2>
          {REPORT.lampRelit && <p className="stamp stamp-lit">Relit</p>}
        </div>
        <div className="tallies">
          <Tally glyph="stairs" label="Floors cleared">{REPORT.floorsCleared}</Tally>
          <Tally glyph="deep" label={`Deepest Floor: ${deepest ? floorLabel(REPORT.deepestFloor) : 'none'}`}>{deepest ? <>{deepest.act}<small>·</small>{deepest.floor}</> : '—'}</Tally>
          <Tally glyph="damage" label={`Damage dealt: ${number(REPORT.damageDealt)}`}>{compact(REPORT.damageDealt)}</Tally>
          <Tally glyph="healed" label="Healed">{compact(REPORT.healed)}</Tally>
          <Tally glyph="guardian" label="Guardian kills">{REPORT.guardianKills}</Tally>
          <Tally glyph="gem" label="Found" wide><Gems {...loot} /></Tally>
        </div>
        <p className="lamp-row" role="img" aria-label={`Lamps relit: ${lampsLit} of ${LAMPS.length}`} title={`Lamps relit: ${lampsLit} of ${LAMPS.length}`}>
          {LAMPS.map((lamp, index) => <Glyph key={index} name={index < lampsLit ? 'lampLit' : 'lampDark'} />)}
        </p>
        <ul className="slips" aria-label="Notes for the Party">
          {findings.map((finding, index) => {
            const active = focus === finding.kind;
            return (
              <li key={finding.kind}>
                <Painted
                  kind="slip"
                  tag="button"
                  className={active ? 'slip active' : 'slip'}
                  data={{ seed: index + 3, active }}
                  aria-pressed={active}
                  title={[finding.title, ...finding.details].join('\n')}
                  onClick={() => onFocus(active ? null : finding.kind)}
                >
                  <Glyph name={FINDING_GLYPHS[finding.kind]} className="slip-icon" colour={RARITY_COLOUR.rare} />
                  <span className="slip-text">
                    {finding.kind === 'loot' ? <Gems {...loot} /> : <strong>{finding.title}</strong>}
                    {active && finding.kind !== 'loot' && finding.details.map((line) => <span key={line} className="slip-detail">{line}</span>)}
                  </span>
                </Painted>
              </li>
            );
          })}
        </ul>
        <StandingOrders priority={priority} flagged={focus === 'picks'} dispatch={dispatch} />
      </div>
    </Painted>
  );
}

/* ---------- The dossier: one Hero in full, with busts for the others. ---------- */

function SkillRow({ hero, skill, flagged, dispatch }: { hero: HeroView; skill: SkillView; flagged: boolean; dispatch: (action: PlayerAction) => void }) {
  const locked = lockText(skill);
  const canSpend = skill.refusal === null;
  return (
    <li className={`skill-row${skill.rank > 0 ? '' : ' unlearned'}${flagged && canSpend ? ' flagged' : ''}`} tabIndex={0}>
      <span className="skill-name">{skill.name}</span>
      <span className="skill-pips" aria-label={`Rank ${skill.rank} of ${skill.maxRank}`}>
        {Array.from({ length: skill.maxRank }, (_, index) =>
          index === skill.rank && canSpend ? (
            <button key={index} type="button" className="pip next" aria-label={`Spend a point on ${skill.name}`} title="Spend a point" onClick={() => dispatch({ type: 'spendSkillPoint', heroId: hero.id, skillId: skill.id })} />
          ) : (
            <span key={index} className={index < skill.rank ? 'pip lit' : 'pip'} />
          ),
        )}
      </span>
      <Painted kind="slip" className="skill-chit" data={{ seed: skill.step + 20 }}>
        <strong>{skill.name}</strong>
        <span className="chit-facts">{skillFacts(skill)}</span>
        <span>{skill.summary}</span>
        {skillValues(skill).map((line) => (
          <span key={line} className="chit-facts">{line}</span>
        ))}
        {locked && <span className="chit-lock">{locked}</span>}
        {skill.blockedByWeapon && <span className="chit-lock">Needs a melee weapon.</span>}
      </Painted>
    </li>
  );
}

interface DossierProps {
  readonly heroes: readonly HeroView[];
  readonly heroIndex: number;
  readonly onHero: (index: number) => void;
  readonly slot: Slot;
  readonly onSlot: (slot: Slot) => void;
  readonly selected: ItemView | null;
  readonly flaggedStat: ItemStat | null;
  readonly flagSkills: boolean;
  readonly onEquip: (itemId: number, hero: HeroView) => void;
  readonly dispatch: (action: PlayerAction) => void;
}

function HeroTabs({ heroes, heroIndex, onHero, onEquip }: Pick<DossierProps, 'heroes' | 'heroIndex' | 'onHero' | 'onEquip'>) {
  return (
    <nav className="dossier-tabs" role="tablist" aria-label="Heroes">
      {heroes.map((other, index) => (
        <button
          key={other.id}
          type="button"
          role="tab"
          aria-selected={index === heroIndex}
          aria-label={`${other.name}${other.unspentPoints > 0 ? `, ${other.unspentPoints} skill points to spend` : ''}`}
          title={other.name}
          className="dossier-tab"
          onClick={() => onHero(index)}
          {...equipDrop(other, onEquip)}
        >
          <Glyph name={CLASS_GLYPH[other.id] ?? 'battle'} className="tab-glyph" />
          {other.unspentPoints > 0 && <span className="tab-points">{other.unspentPoints}</span>}
        </button>
      ))}
    </nav>
  );
}

function Dossier({ heroes, heroIndex, onHero, slot, onSlot, selected, flaggedStat, flagSkills, onEquip, dispatch }: DossierProps) {
  const hero = heroes[heroIndex] ?? heroes[0]!;
  const nameOf = (id: string) => hero.skills.find((skill) => skill.id === id)?.name ?? id;
  const comparing = selected && selected.slot === slot ? selected : null;
  const className = CLASS_TEXT[hero.id] ?? hero.id;
  return (
    <section className="dossier" aria-label="The Party">
      <HeroTabs heroes={heroes} heroIndex={heroIndex} onHero={onHero} onEquip={onEquip} />
      <Painted kind="folder" className="folder">
        <div className="folder-page">
          <div className="dossier-top">
            <div className="portrait-wrap" {...equipDrop(hero, onEquip)}>
              <Painted kind="portrait" className="portrait" data={{ hero: hero.id, oil: (hero.oil / hero.stats.maxOil).toFixed(2) }} />
              <Painted kind="medallion" tag="span" className="level-medallion" title={`Level ${hero.level}`} aria-label={`Level ${hero.level}`}>{hero.level}</Painted>
            </div>
            <div className="dossier-id">
              <Painted kind="nameplate" className="nameplate"><span className="label">{hero.name}</span></Painted>
              {className !== hero.name && <p className="dossier-class">{className}</p>}
              <div className="gauge-row" title={`Experience: ${hero.xp} of ${hero.xpToNext}`}><Glyph name="star" label="Experience" /><Painted kind="gauge" className="gauge-art" data={{ kind: 'oil', fill: (hero.xp / hero.xpToNext).toFixed(3) }} /><small>{Math.round((hero.xp / hero.xpToNext) * 100)}%</small></div>
              <div className="gauge-row" title={`Health: ${Math.round(hero.health)} of ${Math.round(hero.stats.maxHealth)}`}><Glyph name="maxHealth" label="Health" /><Painted kind="gauge" className="gauge-art" data={{ kind: 'health', fill: (hero.health / hero.stats.maxHealth).toFixed(3) }} /><small>{Math.round(hero.health)}</small></div>
              <div className="gauge-row" title={`Oil: ${Math.floor(hero.oil)} of ${hero.stats.maxOil}`}><Glyph name="flame" label="Oil" /><Painted kind="gauge" className="gauge-art" data={{ kind: 'oil', fill: (hero.oil / hero.stats.maxOil).toFixed(3) }} /><small>{Math.floor(hero.oil)}</small></div>
            </div>
          </div>

          <div className="dossier-middle">
            <ul className="gear" aria-label={`${hero.name}'s gear`}>
              {SLOTS.map((gearSlot) => {
                const worn = hero.equipment[gearSlot];
                return (
                  <li key={gearSlot} className={gearSlot === slot ? 'gear-slot active' : 'gear-slot'} {...equipDrop(hero, onEquip)}>
                    <button
                      type="button"
                      className="gear-pick"
                      onClick={() => onSlot(gearSlot)}
                      aria-pressed={gearSlot === slot}
                      aria-label={`${SLOT_TEXT[gearSlot]}: ${worn ? worn.name : 'empty'}`}
                      title={worn ? worn.name : `${SLOT_TEXT[gearSlot]}: empty`}
                      draggable={Boolean(worn)}
                      onDragStart={(event) => event.dataTransfer.setData(WORN_TYPE, gearSlot)}
                    >
                      <Glyph name={gearSlot} className={`slot-glyph slot-${worn?.rarity ?? 'empty'}`} />
                      {worn ? (
                        <span className="gear-worn">
                          <span className={`rarity-${worn.rarity}`}>{baseName(worn)}</span>
                          <StatChips item={worn} />
                        </span>
                      ) : (
                        <span className="hint">—</span>
                      )}
                    </button>
                    {worn && (
                      <button type="button" className="gear-off" title="Take off" aria-label={`Take off ${worn.name}`} onClick={() => dispatch({ type: 'unequipItem', heroId: hero.id, slot: gearSlot })}>
                        <Glyph name="lift" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="stats">
              {STAT_ROWS.map(({ stat, label, value }) => {
                const change = comparing ? statChange(comparing, hero, stat) : 0;
                return (
                  <p key={stat} className={`stat-line${flaggedStat === stat ? ' flagged' : ''}`} title={label}>
                    <Glyph name={STAT_GLYPH[stat]} label={label} />
                    <span className="stat-value">{value(hero)}</span>
                    {change !== 0 && <em className={change > 0 ? 'stat-gain' : 'stat-loss'}>{formatChange(stat, change)}</em>}
                  </p>
                );
              })}
            </div>
          </div>

          <div className="dossier-skills">
            <div className={flagSkills ? 'skills flagged' : 'skills'}>
              <h3>
                {hero.skills[0]?.branch}
                {hero.unspentPoints > 0 && <span className="embers" title={`${hero.unspentPoints} skill points to spend`}>{Array.from({ length: Math.min(hero.unspentPoints, 8) }, (_, index) => <Glyph key={index} name="flame" />)}</span>}
                <button type="button" className="respec" disabled={hero.pointsSpent === 0} aria-label="Respec, free" title="Snuff out every skill and spend again. Free." onClick={() => dispatch({ type: 'respec', heroId: hero.id })}>
                  <Glyph name="snuffer" />
                </button>
              </h3>
              <ul>
                {hero.skills.map((skill) => (
                  <SkillRow key={skill.id} hero={hero} skill={skill} flagged={flagSkills} dispatch={dispatch} />
                ))}
              </ul>
            </div>
            <div className="skill-order" aria-label="Skill order in Battle">
              <h3><Glyph name="battle" label="In Battle" /></h3>
              <Reorder
                items={hero.order}
                className="rune-stones"
                label={nameOf}
                onMove={(order) => dispatch({ type: 'setSkillOrder', heroId: hero.id, order })}
                render={(id, index) => (
                  <>
                    <span className="rune-index">{index + 1}</span>
                    <span>{nameOf(id)}</span>
                  </>
                )}
                after={<li className="rune-last" title="Then the basic attack" aria-label="Then the basic attack"><Glyph name={hero.equipment.weapon ? 'weapon' : 'power'} /></li>}
              />
            </div>
          </div>
        </div>
      </Painted>
    </section>
  );
}

/* ---------- The strongbox: the Stash at the dossier's Slot. Lift the lid and it widens over the dossier. ---------- */

type Mark = 'gain' | 'loss' | 'mixed' | 'none';
const MARK_TEXT: Readonly<Record<Mark, string>> = { gain: 'only gains', loss: 'only losses', mixed: 'gains and losses', none: 'no change' };

/** What an item would do for a Hero, stated rather than judged: all up, all down, both, or nothing. */
function markFor(item: ItemView, hero: HeroView): Mark {
  const changes = changedStats(item, [hero]).map((key) => statChange(item, hero, key));
  if (changes.length === 0) return 'none';
  if (changes.every((change) => change > 0)) return 'gain';
  if (changes.every((change) => change < 0)) return 'loss';
  return 'mixed';
}

function ItemChit({ item, heroes, onEquip }: { item: ItemView; heroes: readonly HeroView[] | null; onEquip: (itemId: number, hero: HeroView) => void }) {
  return (
    <Painted kind="slip" className="item-chit" data={{ seed: 77 }}>
      <strong className={`chit-name rarity-${item.rarity}-ink`}>{item.name}</strong>
      <span className="chit-facts">
        <Glyph name={item.slot} />
        {item.reach && <span>{capital(item.reach)}</span>}
        <span className="chit-level" title={`Needs level ${item.levelRequirement}`}><Glyph name="level" />{item.levelRequirement}</span>
      </span>
      <StatChips item={item} />
      {heroes && (
        <ul className="on-each" aria-label="Equip on">
          {heroes.map((other) => {
            const locked = other.level < item.levelRequirement;
            return (
              <li key={other.id}>
                <button
                  type="button"
                  className="on-each-pick"
                  disabled={locked}
                  aria-label={locked ? `${other.name} needs level ${item.levelRequirement}` : `Equip on ${other.name}`}
                  title={locked ? `${other.name}: needs level ${item.levelRequirement}` : `Equip on ${other.name}`}
                  onClick={() => onEquip(item.id, other)}
                >
                  <Bust hero={other} className="chit-bust" />
                  {locked ? <span className="chip loss"><Glyph name="lock" />{item.levelRequirement}</span> : <ChangeChips item={item} hero={other} limit={3} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Painted>
  );
}

interface StrongboxProps {
  readonly stash: readonly ItemView[];
  readonly heroes: readonly HeroView[];
  readonly hero: HeroView;
  readonly slot: Slot;
  readonly onSlot: (slot: Slot) => void;
  readonly rarity: Rarity | 'all';
  readonly onRarity: (rarity: Rarity | 'all') => void;
  readonly stat: ItemStat | 'all';
  readonly onStat: (stat: ItemStat | 'all') => void;
  readonly sort: DeskSort;
  readonly onSort: (sort: DeskSort) => void;
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
  readonly lidOpen: boolean;
  readonly onLid: () => void;
  readonly onEquip: (itemId: number, hero: HeroView) => void;
  readonly onUnequip: (slot: Slot) => void;
  readonly refusal: string;
}

/** The Strongbox's order: the Stash's own, plus the mockup's "best for this Hero". */
type DeskSort = StashSort | 'best';
const DESK_SORTS: readonly DeskSort[] = ['best', 'rarity', 'newest', 'levelRequirement'];
const sortText = (sort: DeskSort, hero: HeroView): string =>
  ({ best: `Best for ${hero.name}`, rarity: 'Rarest first', newest: 'Newest first', levelRequirement: 'Highest level first' })[sort];

/** How much better an item leaves this Hero: stats gained less stats lost. Mockup only, since weighing one stat
 *  against another is a design call. */
const gainScore = (item: ItemView, hero: HeroView): number => STATS.reduce((score, stat) => score + Math.sign(statChange(item, hero, stat)), 0);

/** The Stash as the desk lists it, grouped, in the desk's order. */
function deskStash(stash: readonly ItemView[], query: { sort: DeskSort; slot: Slot; rarity: Rarity | 'all'; stat: ItemStat | 'all' }, hero: HeroView) {
  const items = queryStash(stash, { ...query, sort: query.sort === 'best' ? 'rarity' : query.sort });
  return groupItems(query.sort === 'best' ? [...items].sort((a, b) => gainScore(b, hero) - gainScore(a, hero)) : items);
}

type FilterProps = Pick<StrongboxProps, 'rarity' | 'onRarity' | 'stat' | 'onStat'>;

/** The order, in words. */
function SortPicker({ sort, onSort, hero }: Pick<StrongboxProps, 'sort' | 'onSort' | 'hero'>) {
  return (
    <label className="sort-picker">
      <span className="sr-only">Order</span>
      <select value={sort} onChange={(event) => onSort(event.target.value as DeskSort)}>
        {DESK_SORTS.map((each) => (
          <option key={each} value={each}>
            {sortText(each, hero)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The filters in force, each a tag that lifts it off. The ledger's notes set them too, so they show whether or not the lid is up. */
function ActiveFilters({ rarity, onRarity, stat, onStat }: FilterProps) {
  if (rarity === 'all' && stat === 'all') return null;
  return (
    <div className="filter-tags" role="group" aria-label="Filters in force">
      {rarity !== 'all' && (
        <button type="button" className="filter-tag" title="Show every rarity" onClick={() => onRarity('all')}>
          <Glyph name="gem" colour={RARITY_COLOUR[rarity]} />
          Only {rarity}
          <span className="filter-off" aria-hidden="true">×</span>
        </button>
      )}
      {stat !== 'all' && (
        <button type="button" className="filter-tag" title="Show items without it too" onClick={() => onStat('all')}>
          <Glyph name={STAT_GLYPH[stat]} />
          With {STAT_TEXT[stat]}
          <span className="filter-off" aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}

/** The sieve tray: every filter, each a glyph with its word. */
function SieveTray({ rarity, onRarity, stat, onStat }: FilterProps) {
  return (
    <div className="sieve-tray" id="sieve-tray">
      <fieldset>
        <legend>Rarity</legend>
        {RARITIES.map((each) => (
          <button key={each} type="button" aria-pressed={rarity === each} onClick={() => onRarity(rarity === each ? 'all' : each)}>
            <Glyph name="gem" colour={RARITY_COLOUR[each]} />
            {capital(each)}
          </button>
        ))}
      </fieldset>
      <fieldset>
        <legend>Has</legend>
        {STATS.map((each) => (
          <button key={each} type="button" aria-pressed={stat === each} onClick={() => onStat(stat === each ? 'all' : each)}>
            <Glyph name={STAT_GLYPH[each]} />
            {capital(STAT_TEXT[each])}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

function Strongbox(props: StrongboxProps) {
  const { stash, heroes, hero, slot, onSlot, rarity, stat, sort, selectedKey, onSelect, lidOpen, onLid, onEquip, onUnequip, refusal } = props;
  const groups = useMemo(() => deskStash(stash, { sort, slot, rarity, stat }, hero), [stash, sort, slot, rarity, stat, hero]);
  const [sieveOpen, setSieveOpen] = useState(false);
  const selected = groups.find((group) => group.key === selectedKey) ?? groups[0] ?? null;
  const empty = <p className="hint empty-box">Nothing here.</p>;
  const dragItem = (item: ItemView) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(ITEM_TYPE, String(item.id));
    },
  });
  return (
    <Painted
      kind="strongbox"
      tag="section"
      className={lidOpen ? 'strongbox open' : 'strongbox'}
      data={{ open: lidOpen }}
      aria-label="Stash"
      onDragOver={(event: DragEvent) => {
        if (event.dataTransfer.types.includes(WORN_TYPE)) event.preventDefault();
      }}
      onDrop={(event: DragEvent) => {
        const worn = event.dataTransfer.getData(WORN_TYPE) as Slot;
        if (worn) onUnequip(worn);
      }}
    >
      <button type="button" className="lid" aria-expanded={lidOpen} aria-label={lidOpen ? 'Lower the lid' : 'Lift the lid'} title={lidOpen ? 'Lower the lid' : 'Lift the lid'} onClick={onLid} />
      <h2 className="sr-only">Strongbox</h2>
      <div className="strongbox-head">
        {lidOpen ? (
          <nav className="slot-tabs" aria-label="Slot">
            {SLOTS.map((each) => (
              <button key={each} type="button" aria-pressed={each === slot} onClick={() => onSlot(each)}>
                <Glyph name={each} />
                {SLOT_TEXT[each]}
              </button>
            ))}
          </nav>
        ) : (
          <span className="strongbox-for">
            <Bust hero={hero} className="for-bust" />
            <span className="for-words">
              <b>{hero.name}</b>
              <span>
                <Glyph name={slot} /> {SLOT_TEXT[slot]}
              </span>
            </span>
          </span>
        )}
        <span className="box-count">{stash.length} items</span>
      </div>
      <div className="strongbox-tools">
        <SortPicker sort={sort} onSort={props.onSort} hero={hero} />
        {lidOpen && (
          <button type="button" className="sieve" aria-expanded={sieveOpen} aria-controls="sieve-tray" onClick={() => setSieveOpen((open) => !open)}>
            <Glyph name="sieve" />
            Sieve
          </button>
        )}
      </div>
      {lidOpen && sieveOpen && <SieveTray {...props} />}
      <ActiveFilters {...props} />
      {refusal && <p className="stamp stamp-refused" role="alert">{refusal}</p>}
      {lidOpen ? (
        <div className="box-open">
          <ul className="tag-grid">
            {groups.map((group, index) => (
              <li key={group.key} style={{ '--i': Math.min(index, 24) } as React.CSSProperties}>
                <button type="button" className={`tag tag-${group.item.rarity}${group.key === selected?.key ? ' active' : ''}`} title={group.item.name} onClick={() => onSelect(group.key)} {...dragItem(group.item)}>
                  <span className={`tag-name rarity-${group.item.rarity}`}>{baseName(group.item)}</span>
                  {group.count > 1 && <span className="tag-count">×{group.count}</span>}
                  <StatChips item={group.item} />
                  <span className="tag-marks">
                    {heroes.map((each) => {
                      const mark = markFor(group.item, each);
                      return <span key={each.id} className={`mark mark-${mark}`} title={`${each.name}: ${MARK_TEXT[mark]}`} />;
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {groups.length === 0 && empty}
          {selected && <ItemChit item={selected.item} heroes={null} onEquip={onEquip} />}
        </div>
      ) : (
        <>
          <ul className="strongbox-rows">
            {groups.map((group) => (
              <li key={group.key}>
                <button type="button" className={group.key === selected?.key ? 'box-row active' : 'box-row'} title={group.item.name} onClick={() => onSelect(group.key)} {...dragItem(group.item)}>
                  <span className={`box-name rarity-${group.item.rarity}`}>{baseName(group.item)}{group.count > 1 && <span className="hint"> ×{group.count}</span>}</span>
                  <ChangeChips item={group.item} hero={hero} limit={3} />
                </button>
              </li>
            ))}
            {groups.length === 0 && <li>{empty}</li>}
          </ul>
          {selected && <ItemChit item={selected.item} heroes={heroes} onEquip={onEquip} />}
        </>
      )}
    </Painted>
  );
}

/* ---------- The spine: with the lid up, the dossier folds to three Hero cards that carry the comparison. ---------- */

interface SpineProps {
  readonly heroes: readonly HeroView[];
  readonly heroIndex: number;
  readonly onHero: (index: number) => void;
  readonly slot: Slot;
  readonly selected: ItemView | null;
  readonly onEquip: (itemId: number, hero: HeroView) => void;
}

function Spine({ heroes, heroIndex, onHero, slot, selected, onEquip }: SpineProps) {
  return (
    <section className="spine" aria-label="The Party">
      {heroes.map((each, index) => {
        const worn = each.equipment[slot];
        const locked = selected ? each.level < selected.levelRequirement : false;
        return (
          <Painted key={each.id} kind="folder" className={index === heroIndex ? 'spine-card active' : 'spine-card'} {...equipDrop(each, onEquip)}>
            <button type="button" className="spine-pick" aria-pressed={index === heroIndex} onClick={() => onHero(index)}>
              <span className="spine-bust-wrap">
                <Bust hero={each} className="spine-portrait" />
                <Painted kind="medallion" tag="span" className="level-medallion small" aria-label={`Level ${each.level}`}>{each.level}</Painted>
              </span>
              <span className="spine-who">
                <strong>{each.name}</strong>
                <span className="spine-worn" title={worn ? worn.name : 'Empty'}>
                  <Glyph name={slot} className={`slot-glyph slot-${worn?.rarity ?? 'empty'}`} />
                  {worn ? <span className={`rarity-${worn.rarity}`}>{baseName(worn)}</span> : <span className="hint">—</span>}
                </span>
              </span>
            </button>
            {selected && selected.slot === slot && (
              <button
                type="button"
                className="spine-compare"
                disabled={locked}
                aria-label={locked ? `${each.name} needs level ${selected.levelRequirement}` : `Equip on ${each.name}`}
                title={locked ? `Needs level ${selected.levelRequirement}` : `Equip on ${each.name}`}
                onClick={() => onEquip(selected.id, each)}
              >
                {locked ? <span className="chip loss"><Glyph name="lock" />{selected.levelRequirement}</span> : <ChangeChips item={selected} hero={each} limit={4} />}
                {!locked && <Glyph name="equip" className="equip-glyph" />}
              </button>
            )}
          </Painted>
        );
      })}
    </section>
  );
}

/* ---------- The desk. ---------- */

function Desk() {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const view = viewGame(game);
  const stash = viewStash(game);
  const findings = describeFindings(REPORT, view);
  const [focus, setFocus] = useState<FindingKind | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [slot, setSlot] = useState<Slot>('weapon');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [stat, setStat] = useState<ItemStat | 'all'>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sort, setSort] = useState<DeskSort>('best');
  const [lidOpen, setLidOpen] = useState(false);
  const [refusal, setRefusal] = useState('');

  const dispatch = (action: PlayerAction) => {
    const result = applyAction(game, action);
    rerender();
    return result as { ok: boolean; reason?: string };
  };

  /** A note on the desk points at what answers it, rather than opening a page of its own. */
  const onFocus = (kind: FindingKind | null) => {
    setFocus(kind);
    const finding = findings.find((entry) => entry.kind === kind);
    if (!finding) return;
    if (kind === 'setbacks') {
      setStat(finding.stat ?? 'all');
      setRarity('all');
    }
    if (kind === 'loot') {
      setRarity(REPORT.loot.rare > 0 ? 'rare' : 'all');
      setStat('all');
    }
    if (kind === 'points') {
      const index = view.heroes.findIndex((hero) => hero.unspentPoints > 0);
      if (index >= 0) setHeroIndex(index);
    }
  };

  const hero = view.heroes[heroIndex] ?? view.heroes[0]!;
  const groups = deskStash(stash, { sort, slot, rarity, stat }, hero);
  /** The lid swings as a view transition: the browser animates between pictures of the desk before and after,
   *  so the painted canvases never repaint mid-swing. Reduced motion, or a browser without it, just swaps. */
  const toggleLid = () => {
    const swap = () => setLidOpen((open) => !open);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = (document as Document & { startViewTransition?: (update: () => void) => unknown }).startViewTransition;
    if (!start || reduced) return swap();
    document.documentElement.dataset.lid = lidOpen ? 'closing' : 'opening';
    const transition = start.call(document, () => flushSync(swap)) as { finished: Promise<void> };
    void transition.finished.finally(() => delete document.documentElement.dataset.lid);
  };
  const report = (result: { ok: boolean; reason?: string }) => setRefusal(result.ok ? '' : (REFUSAL_TEXT as Record<string, string>)[result.reason ?? ''] ?? 'Refused.');
  const equip = (itemId: number, target: HeroView) => report(dispatch({ type: 'equipItem', heroId: target.id, itemId }));
  const unequip = (from: Slot) => report(dispatch({ type: 'unequipItem', heroId: hero.id, slot: from }));
  const selected = (groups.find((group) => group.key === selectedKey) ?? groups[0])?.item ?? null;

  return (
    <div className="desk-app">
      <header className="app-header">
        <h1>autoBattler</h1>
        <span className="hint desk-note">Mockup: the Council desk, on a real game caught up 3 hours.</span>
        <span className="desk-scale">
          Art pixel
          <button type="button" onClick={() => setScale(3)}>3</button>
          <button type="button" onClick={() => setScale(4)}>4</button>
        </span>
      </header>
      <Painted kind="desk" tag="div" className={lidOpen ? 'desk lid-open' : 'desk'}>
        <Ledger findings={findings} focus={focus} onFocus={onFocus} priority={view.pickPriority} lampsLit={view.wall.lampsLit} dispatch={dispatch} />
        {lidOpen ? (
          <Spine heroes={view.heroes} heroIndex={heroIndex} onHero={setHeroIndex} slot={slot} selected={selected} onEquip={equip} />
        ) : (
          <Dossier
            heroes={view.heroes}
            heroIndex={heroIndex}
            onHero={setHeroIndex}
            slot={slot}
            onSlot={setSlot}
            selected={selected}
            flaggedStat={focus === 'setbacks' ? (findings.find((entry) => entry.kind === 'setbacks')?.stat ?? null) : null}
            flagSkills={focus === 'points'}
            onEquip={equip}
            dispatch={dispatch}
          />
        )}
        <Strongbox
          stash={stash}
          heroes={view.heroes}
          hero={hero}
          slot={slot}
          onSlot={setSlot}
          rarity={rarity}
          onRarity={setRarity}
          stat={stat}
          onStat={setStat}
          sort={sort}
          onSort={setSort}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          lidOpen={lidOpen}
          onLid={toggleLid}
          onEquip={equip}
          onUnequip={unequip}
          refusal={refusal}
        />
      </Painted>
    </div>
  );
}

function setScale(px: number): void {
  document.documentElement.style.setProperty('--art', `${px}px`);
  window.dispatchEvent(new Event('repaint'));
}

function Lanterns() {
  useEffect(() => {
    const timer = setInterval(() => {
      nextFrame();
      document.querySelectorAll<HTMLElement>('[data-art="nameplate"]').forEach(paint);
    }, 260);
    return () => clearInterval(timer);
  }, []);
  return null;
}

void artPx;
// Hot reload re-runs this module, so reuse the root it made the first time.
const holder = document.querySelector('#desk') as HTMLElement & { root?: ReturnType<typeof createRoot> };
holder.root ??= createRoot(holder);
holder.root.render(
  <>
    <Desk />
    <Lanterns />
  </>,
);
