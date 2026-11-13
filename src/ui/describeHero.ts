import { TICK_MS, type SkillReach, type SkillView } from '../sim';
import type { DispatchRefusal } from './store';

const REACH_TEXT: Readonly<Record<SkillReach, string>> = {
  self: 'Self',
  melee: 'Melee',
  ranged: 'Ranged',
  spell: 'Spell',
  anyHero: 'Any Hero',
  everyHero: 'Every Hero',
};

const ROW_TEXT = { front: 'Front Row', back: 'Back Row', either: 'Either Row' } as const;

/** Words for a refused action. */
export const REFUSAL_TEXT: Readonly<Record<DispatchRefusal, string>> = {
  catchingUp: 'Wait for the Party to catch up.',
  notInTown: 'The Party can only be sent from Town.',
  unknownHero: 'No such Hero.',
  unknownSkill: 'No such skill.',
  otherClass: 'Another Class holds this skill.',
  freeSkill: 'A free Class skill has a fixed strength.',
  noPoints: 'No skill points left.',
  stepLocked: 'Spend more points in this Branch first.',
  maxRank: 'This skill is at its top rank.',
  badOrder: 'The order holds up to 3 learned active skills, each once.',
  badPickPriority: 'The Pick rule must list every tag once.',
  emptyName: 'A Hero needs a name.',
  nameTooLong: 'Names can hold 24 characters at most.',
  unknownItem: 'That item is not in the Stash.',
  belowLevelRequirement: 'This Hero is below the level requirement.',
  emptySlot: 'Nothing is equipped there.',
};

/** A number of Ticks in seconds, such as "2.7s". */
export const seconds = (ticks: number): string => `${(ticks * TICK_MS) / 1000}s`;

/** The skill's fixed facts: where it works, its reach, and its costs. */
export function skillFacts(skill: SkillView): string {
  const facts = [skill.kind === 'active' ? 'Active' : 'Passive', ROW_TEXT[skill.row]];
  if (skill.reach) facts.push(REACH_TEXT[skill.reach]);
  if (skill.oil > 0) facts.push(`${skill.oil} Oil`);
  if (skill.cooldown > 0) facts.push(`${seconds(skill.cooldown)} cooldown`);
  return facts.join(' · ');
}

const percent = (value: number): string => `${value}%`;

/** One line per scaling value, such as "Bonus armour: 20% → 30%". */
export function skillValues(skill: SkillView): readonly string[] {
  return skill.values.map(({ label, current, next }) => {
    if (current === null) return `${label}: ${next === null ? '' : `${percent(next)} at rank 1`}`;
    return `${label}: ${percent(current)}${next === null ? '' : ` → ${percent(next)}`}`;
  });
}

/** Why the rank button is disabled, or null if it isn't. */
export const lockText = (skill: SkillView): string | null =>
  skill.refusal === 'stepLocked' ? `Needs ${skill.pointsToOpen} points in ${skill.branch}` : null;
