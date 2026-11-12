/* The Council desk: the Away Report, Planning, and the Stash as one screen. A mockup on the real sim. */
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
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  applyAction,
  beginCatchUp,
  continueCatchUp,
  createGame,
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
import { describeAbsence } from '../src/ui/describeAwayReport';
import { describeFindings, type Finding, type FindingKind } from '../src/ui/describeFindings';
import { lockText, REFUSAL_TEXT, seconds, skillFacts, skillValues } from '../src/ui/describeHero';
import { changedStats, formatChange, itemStatsText, SLOT_TEXT, STAT_TEXT, statChange } from '../src/ui/describeItem';
import { describeTag, TAG_TEXT } from '../src/ui/describePicks';
import { floorLabel } from '../src/ui/floorLabel';
import { PixelIcon, type IconName } from '../src/ui/PixelIcon';
import { groupItems, queryStash, type StashSort } from '../src/ui/stashQuery';
import { artPx, nextFrame, paint } from './painters';
import './desk-painters';

/* ---------- The game: a real one, caught up a few hours so the report, levels, and Stash are genuine. ---------- */

const game = createGame({ seed: 8, scenario: { heroLevel: 4 } });
const catchUp = beginCatchUp(game, 3 * 60 * 60 * 1000);
let report: AwayReport | null = null;
while (!report) report = continueCatchUp(game, catchUp, 20_000);
const REPORT: AwayReport = report;

/* ---------- Painted elements. ---------- */

function Painted({ kind, tag = 'div', className = '', data = {}, children, ...rest }: { kind: string; tag?: 'div' | 'section' | 'button' | 'aside' | 'article'; className?: string; data?: Record<string, string | number | boolean>; children?: ReactNode } & Record<string, unknown>) {
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

const FINDING_ICONS: Readonly<Record<FindingKind, IconName>> = { setbacks: 'skull', picks: 'cog', loot: 'chest', points: 'flame' };
const CLASS_TEXT: Readonly<Record<string, string>> = { 'sin-eater': 'Sin-Eater', warrener: 'Warrener', lamplighter: 'Lamplighter' };
const STAT_ROWS: readonly { stat: ItemStat; label: string; value: (hero: HeroView) => string }[] = [
  { stat: 'maxHealth', label: 'Health', value: (hero) => `${Math.round(hero.stats.maxHealth)}` },
  { stat: 'power', label: 'Power', value: (hero) => `${Math.round(hero.stats.power)}` },
  { stat: 'armour', label: 'Armour', value: (hero) => `${Math.round(hero.stats.armour)}` },
  { stat: 'critChance', label: 'Critical chance', value: (hero) => `${hero.stats.critChance}%` },
  { stat: 'poisonResistance', label: 'Poison resistance', value: (hero) => `${Math.round(hero.stats.poisonResistance)}%` },
  { stat: 'speed', label: 'Acts every', value: (hero) => seconds(hero.stats.actionInterval) },
];
const number = (value: number) => Math.round(value).toLocaleString('en-GB');

/* ---------- The ledger: the Away Report, its Findings as slips, the Wall, and the standing orders. ---------- */

function StandingOrders({ priority, flagged, dispatch }: { priority: readonly PickTag[]; flagged: boolean; dispatch: (action: PlayerAction) => void }) {
  const move = (index: number, by: number) => {
    const order = [...priority];
    const [tag] = order.splice(index, 1);
    if (!tag) return;
    order.splice(index + by, 0, tag);
    dispatch({ type: 'setPickPriority', priority: order });
  };
  return (
    <section className={flagged ? 'orders flagged' : 'orders'} aria-label="Standing orders">
      <h3>Standing orders <span className="hint">· Picks</span></h3>
      <p className="hint">Twice a Run the Party is offered 3 Picks and keeps the one ranked highest here.</p>
      <ol>
        {priority.map((tag, index) => (
          <li key={tag} title={describeTag(tag).join('\n')}>
            <span className="order-rank">{index + 1}</span>
            <span className="order-tag">{TAG_TEXT[tag]}</span>
            <button type="button" aria-label={`Move ${TAG_TEXT[tag]} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" aria-label={`Move ${TAG_TEXT[tag]} down`} disabled={index === priority.length - 1} onClick={() => move(index, 1)}>↓</button>
          </li>
        ))}
      </ol>
    </section>
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
  return (
    <Painted kind="ledger" tag="section" className="ledger" aria-label="Away Report">
      <div className="ledger-page">
      <h2>Away Report</h2>
      <p className="absence">{describeAbsence(REPORT)}</p>
      <div className="ledger-lines">
        <p className="ledger-line"><span>Floors cleared</span><span>{REPORT.floorsCleared}</span></p>
        <p className="ledger-line"><span>Deepest Floor</span><span>{REPORT.deepestFloor > 0 ? floorLabel(REPORT.deepestFloor) : 'none'}</span></p>
        <p className="ledger-line"><span>Damage dealt</span><span>{number(REPORT.damageDealt)}</span></p>
        <p className="ledger-line"><span>Healed</span><span>{number(REPORT.healed)}</span></p>
        <p className="ledger-line"><span>Guardian kills</span><span>{REPORT.guardianKills}</span></p>
        <p className="ledger-line"><span>Found</span><span><span className="rarity-common">{loot.common}</span> · <span className="rarity-magic">{loot.magic}</span> · <span className="rarity-rare">{loot.rare}</span></span></p>
        <p className="ledger-line"><span>Lamps relit</span><span>{lampsLit} of {LAMPS.length}</span></p>
      </div>
      {REPORT.lampRelit && <p className="stamp stamp-lit">The Lamp is relit</p>}
      <h3 className="slips-head">Notes for the Party</h3>
      <ul className="slips">
        {findings.map((finding, index) => (
          <li key={finding.kind}>
            <Painted
              kind="slip"
              tag="button"
              className={focus === finding.kind ? 'slip active' : 'slip'}
              data={{ seed: index + 3, active: focus === finding.kind }}
              aria-pressed={focus === finding.kind}
              onClick={() => onFocus(focus === finding.kind ? null : finding.kind)}
            >
              <PixelIcon name={FINDING_ICONS[finding.kind]} className="slip-icon" />
              <span className="slip-text">
                <strong>{finding.title}</strong>
                {(focus === finding.kind ? finding.details : finding.details.slice(0, 1)).map((line) => (
                  <span key={line} className="slip-detail">{line}</span>
                ))}
              </span>
            </Painted>
          </li>
        ))}
        {findings.length === 0 && <li className="hint">Nothing to act on.</li>}
      </ul>
      <StandingOrders priority={priority} flagged={focus === 'picks'} dispatch={dispatch} />
      </div>
      <div className="send-dock">
        <button type="button" className="lit-button send-back" onClick={() => alert('Mockup: the Party would set out again.')}>
          Send the Party back
        </button>
      </div>
    </Painted>
  );
}

/* ---------- The dossier: one Hero in full, with index tabs for the others. ---------- */

function SkillRow({ hero, skill, flagged, dispatch }: { hero: HeroView; skill: SkillView; flagged: boolean; dispatch: (action: PlayerAction) => void }) {
  const locked = lockText(skill);
  return (
    <li className={`skill-row${skill.rank > 0 ? '' : ' unlearned'}${flagged && skill.refusal === null ? ' flagged' : ''}`} tabIndex={0}>
      <span className="skill-name">{skill.name}</span>
      <span className="skill-pips" aria-label={`Rank ${skill.rank} of ${skill.maxRank}`}>
        {Array.from({ length: skill.maxRank }, (_, index) => (
          <span key={index} className={index < skill.rank ? 'pip lit' : 'pip'} />
        ))}
      </span>
      <button type="button" aria-label={`Spend a point on ${skill.name}`} disabled={skill.refusal !== null} onClick={() => dispatch({ type: 'spendSkillPoint', heroId: hero.id, skillId: skill.id })}>
        +
      </button>
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
  readonly dispatch: (action: PlayerAction) => void;
}

function Dossier({ heroes, heroIndex, onHero, slot, onSlot, selected, flaggedStat, flagSkills, dispatch }: DossierProps) {
  const hero = heroes[heroIndex] ?? heroes[0]!;
  const nameOf = (id: string) => hero.skills.find((skill) => skill.id === id)?.name ?? id;
  const moveOrder = (index: number, by: number) => {
    const order = [...hero.order];
    const [skill] = order.splice(index, 1);
    if (!skill) return;
    order.splice(index + by, 0, skill);
    dispatch({ type: 'setSkillOrder', heroId: hero.id, order });
  };
  const comparing = selected && selected.slot === slot ? selected : null;
  return (
    <section className="dossier" aria-label="The Party">
      <nav className="dossier-tabs" role="tablist" aria-label="Heroes">
        {heroes.map((other, index) => (
          <button key={other.id} type="button" role="tab" aria-selected={index === heroIndex} className="dossier-tab" onClick={() => onHero(index)}>
            {other.name}
            {other.unspentPoints > 0 && <span className="tab-points" title={`${other.unspentPoints} skill points to spend`}>{other.unspentPoints}</span>}
          </button>
        ))}
      </nav>
      <Painted kind="folder" className="folder">
        <div className="folder-page">
        <div className="dossier-top">
          <Painted kind="portrait" className="portrait" data={{ hero: hero.id, oil: (hero.oil / hero.stats.maxOil).toFixed(2) }} />
          <div className="dossier-id">
            <Painted kind="nameplate" className="nameplate"><span className="label">{CLASS_TEXT[hero.id] ?? hero.id}</span></Painted>
            <p className="dossier-name">{hero.name} <span className="hint">· level {hero.level}</span></p>
            <div className="gauge-row"><span>XP</span><Painted kind="gauge" className="gauge-art" data={{ kind: 'oil', fill: (hero.xp / hero.xpToNext).toFixed(3) }} /><small>{hero.xp} / {hero.xpToNext}</small></div>
            <div className="gauge-row"><span>Health</span><Painted kind="gauge" className="gauge-art" data={{ kind: 'health', fill: (hero.health / hero.stats.maxHealth).toFixed(3) }} /><small>{Math.round(hero.health)}</small></div>
            <div className="gauge-row"><span>Oil</span><Painted kind="gauge" className="gauge-art" data={{ kind: 'oil', fill: (hero.oil / hero.stats.maxOil).toFixed(3) }} /><small>{Math.floor(hero.oil)}</small></div>
          </div>
        </div>

        <div className="dossier-middle">
          <ul className="gear" aria-label={`${hero.name}'s gear`}>
            {SLOTS.map((gearSlot) => {
              const worn = hero.equipment[gearSlot];
              return (
                <li key={gearSlot} className={gearSlot === slot ? 'gear-slot active' : 'gear-slot'}>
                  <button type="button" className="gear-pick" onClick={() => onSlot(gearSlot)} aria-pressed={gearSlot === slot}>
                    <PixelIcon name={gearSlot} className={`slot-icon slot-icon-${worn?.rarity ?? 'empty'}`} />
                    <span>
                      <span className="hint gear-slot-name">{SLOT_TEXT[gearSlot]}</span>
                      {worn ? <span className={`rarity-${worn.rarity}`}>{worn.name}</span> : <span className="hint">Empty</span>}
                    </span>
                  </button>
                  {worn && (
                    <button type="button" className="gear-off" title="Unequip" aria-label={`Unequip ${worn.name}`} onClick={() => dispatch({ type: 'unequipItem', heroId: hero.id, slot: gearSlot })}>
                      ×
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
                <p key={stat} className={`ledger-line${flaggedStat === stat ? ' flagged' : ''}`}>
                  <span>{label}</span>
                  <span>
                    {value(hero)}
                    {change !== 0 && <em className={stat === 'speed' ? (change > 0 ? 'stat-gain' : 'stat-loss') : change > 0 ? 'stat-gain' : 'stat-loss'}> {formatChange(stat, change)}</em>}
                  </span>
                </p>
              );
            })}
          </div>
        </div>

        <div className="dossier-skills">
          <div className={flagSkills ? 'skills flagged' : 'skills'}>
            <h3>{hero.skills[0]?.branch} <span className="hint">· {hero.unspentPoints} to spend</span></h3>
            <ul>
              {hero.skills.map((skill) => (
                <SkillRow key={skill.id} hero={hero} skill={skill} flagged={flagSkills} dispatch={dispatch} />
              ))}
            </ul>
          </div>
          <div className="skill-order">
            <h3>In Battle</h3>
            <ol>
              {hero.order.map((id, index) => (
                <li key={id}>
                  <span>{nameOf(id)}</span>
                  <button type="button" aria-label={`Move ${nameOf(id)} earlier`} disabled={index === 0} onClick={() => moveOrder(index, -1)}>↑</button>
                  <button type="button" aria-label={`Move ${nameOf(id)} later`} disabled={index === hero.order.length - 1} onClick={() => moveOrder(index, 1)}>↓</button>
                </li>
              ))}
              <li className="hint">then the basic attack</li>
            </ol>
            <button type="button" className="respec" disabled={hero.pointsSpent === 0} onClick={() => dispatch({ type: 'respec', heroId: hero.id })}>
              Respec, free
            </button>
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

function Changes({ item, hero, limit = 3 }: { item: ItemView; hero: HeroView; limit?: number }) {
  const keys = changedStats(item, [hero]).slice(0, limit);
  if (keys.length === 0) return <>No change</>;
  return (
    <>
      {keys.map((key) => {
        const change = statChange(item, hero, key);
        return <span key={key} className={change > 0 ? 'ink-gain' : 'ink-loss'}>{formatChange(key, change)} {STAT_TEXT[key]} </span>;
      })}
    </>
  );
}

function ItemChit({ item, heroes, onEquip }: { item: ItemView; heroes: readonly HeroView[] | null; onEquip: (item: ItemView, hero: HeroView) => void }) {
  return (
    <Painted kind="slip" className="item-chit" data={{ seed: 77 }}>
      <strong className={`chit-name rarity-${item.rarity}-ink`}>{item.name}</strong>
      <span className="chit-facts">{SLOT_TEXT[item.slot]}{item.reach ? `, ${item.reach}` : ''} · needs level {item.levelRequirement}</span>
      <span>{itemStatsText(item.stats)}</span>
      {heroes && (
        <ul className="on-each">
          {heroes.map((other) => (
            <li key={other.id}>
              <span className="on-each-name">{other.name}</span>
              <span className="on-each-changes"><Changes item={item} hero={other} /></span>
              {other.level < item.levelRequirement ? (
                <span className="chit-lock">Level {item.levelRequirement}</span>
              ) : (
                <button type="button" onClick={() => onEquip(item, other)}>Equip</button>
              )}
            </li>
          ))}
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
  readonly sort: StashSort;
  readonly onSort: (sort: StashSort) => void;
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
  readonly lidOpen: boolean;
  readonly onLid: () => void;
  readonly onEquip: (item: ItemView, hero: HeroView) => void;
  readonly refusal: string;
}

function Strongbox({ stash, heroes, hero, slot, onSlot, rarity, onRarity, stat, onStat, sort, onSort, selectedKey, onSelect, lidOpen, onLid, onEquip, refusal }: StrongboxProps) {
  const groups = useMemo(() => groupItems(queryStash(stash, { sort, slot, rarity, stat })), [stash, sort, slot, rarity, stat]);
  const selected = groups.find((group) => group.key === selectedKey) ?? groups[0] ?? null;
  const empty = <p className="hint">Nothing for this Slot{rarity !== 'all' || stat !== 'all' ? ' with these filters' : ''}.</p>;
  return (
    <Painted kind="strongbox" tag="section" className={lidOpen ? 'strongbox open' : 'strongbox'} data={{ open: lidOpen }} aria-label="Stash">
      <div className="strongbox-head">
        <h2>Strongbox</h2>
        <span className="hint">{stash.length} items</span>
        <button type="button" className="lid-handle" aria-expanded={lidOpen} onClick={onLid}>
          {lidOpen ? 'Lower the lid' : 'Lift the lid'}
        </button>
      </div>
      {lidOpen ? (
        <nav className="slot-tabs" aria-label="Slot">
          {SLOTS.map((each) => (
            <button key={each} type="button" aria-pressed={each === slot} onClick={() => onSlot(each)}>
              <PixelIcon name={each} /> {SLOT_TEXT[each]}
            </button>
          ))}
        </nav>
      ) : (
        <p className="strongbox-for">{SLOT_TEXT[slot]} items, compared on <strong>{hero.name}</strong></p>
      )}
      <div className="strongbox-filters">
        <select aria-label="Rarity" value={rarity} onChange={(event) => onRarity(event.target.value as Rarity | 'all')}>
          <option value="all">Any rarity</option>
          <option value="common">Common</option>
          <option value="magic">Magic</option>
          <option value="rare">Rare</option>
        </select>
        <select aria-label="Has stat" value={stat} onChange={(event) => onStat(event.target.value as ItemStat | 'all')}>
          <option value="all">Any stat</option>
          {(Object.keys(STAT_TEXT) as ItemStat[]).map((key) => (
            <option key={key} value={key}>{STAT_TEXT[key]}</option>
          ))}
        </select>
        <select aria-label="Sort" value={sort} onChange={(event) => onSort(event.target.value as StashSort)}>
          <option value="rarity">By rarity</option>
          <option value="newest">Newest</option>
          <option value="levelRequirement">By level</option>
        </select>
      </div>
      {refusal && <p className="stamp stamp-refused" role="alert">{refusal}</p>}
      {lidOpen ? (
        <div className="box-open">
          <ul className="tag-grid">
            {groups.map((group, index) => (
              <li key={group.key} style={{ '--i': Math.min(index, 24) } as React.CSSProperties}>
                <button type="button" className={`tag tag-${group.item.rarity}${group.key === selected?.key ? ' active' : ''}`} onClick={() => onSelect(group.key)}>
                  <PixelIcon name={group.item.slot} className={`slot-icon slot-icon-${group.item.rarity}`} />
                  <span className={`tag-name rarity-${group.item.rarity}`}>{group.item.name}</span>
                  {group.count > 1 && <span className="tag-count">×{group.count}</span>}
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
            {groups.map((group) => {
              const changes = changedStats(group.item, [hero]).slice(0, 2);
              return (
                <li key={group.key}>
                  <button type="button" className={group.key === selected?.key ? 'box-row active' : 'box-row'} onClick={() => onSelect(group.key)}>
                    <PixelIcon name={group.item.slot} className={`slot-icon slot-icon-${group.item.rarity}`} />
                    <span className={`box-name rarity-${group.item.rarity}`}>{group.item.name}{group.count > 1 && <span className="hint"> ×{group.count}</span>}</span>
                    <span className="box-change">
                      {changes.map((key) => {
                        const change = statChange(group.item, hero, key);
                        return <span key={key} className={change > 0 ? 'stat-gain' : 'stat-loss'}>{formatChange(key, change)} {STAT_TEXT[key]}</span>;
                      })}
                    </span>
                  </button>
                </li>
              );
            })}
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
  readonly onEquip: (item: ItemView, hero: HeroView) => void;
}

function Spine({ heroes, heroIndex, onHero, slot, selected, onEquip }: SpineProps) {
  return (
    <section className="spine" aria-label="The Party">
      {heroes.map((each, index) => {
        const worn = each.equipment[slot];
        return (
          <Painted key={each.id} kind="folder" className={index === heroIndex ? 'spine-card active' : 'spine-card'}>
            <button type="button" className="spine-pick" aria-pressed={index === heroIndex} onClick={() => onHero(index)}>
              <Painted kind="portrait" className="spine-portrait" data={{ frame: 'bust', hero: each.id, oil: (each.oil / each.stats.maxOil).toFixed(2) }} />
              <span className="spine-who">
                <strong>{each.name}</strong>
                <span className="hint">Level {each.level}</span>
              </span>
            </button>
            <p className="spine-worn">
              <span className="hint">{SLOT_TEXT[slot]}: </span>
              {worn ? <span className={`rarity-${worn.rarity}`}>{worn.name}</span> : <span className="hint">empty</span>}
            </p>
            {selected && selected.slot === slot && (
              <div className="spine-compare">
                <span className="spine-changes"><Changes item={selected} hero={each} limit={4} /></span>
                {each.level < selected.levelRequirement ? (
                  <span className="spine-lock">Needs level {selected.levelRequirement}</span>
                ) : (
                  <button type="button" onClick={() => onEquip(selected, each)}>Equip</button>
                )}
              </div>
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
  const [sort, setSort] = useState<StashSort>('rarity');
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
  const groups = groupItems(queryStash(stash, { sort, slot, rarity, stat }));
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
  const equip = (item: ItemView, target: HeroView) => {
    const result = dispatch({ type: 'equipItem', heroId: target.id, itemId: item.id });
    setRefusal(result.ok ? '' : (REFUSAL_TEXT as Record<string, string>)[result.reason ?? ''] ?? 'Refused.');
  };
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
