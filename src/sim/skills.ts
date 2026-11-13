import { isNumber, isRecord } from './guards';
import { isSkillId, MAX_SKILL_RANK, POINTS_PER_STEP, SKILL_IDS, SKILLS, type HeroId, type SkillId } from './content/skills';

export type SkillRanks = Readonly<Partial<Record<SkillId, number>>>;
export type SpendRefusal = 'unknownSkill' | 'otherClass' | 'freeSkill' | 'noPoints' | 'stepLocked' | 'maxRank';

export const isFreeSkill = (id: SkillId): boolean => SKILLS[id].free === true;

/** Each Class's free Class skill. */
export const freeSkillOf = (heroId: HeroId): SkillId => SKILL_IDS.find((id) => isFreeSkill(id) && SKILLS[id].heroId === heroId)!;

export const spentPoints = (ranks: SkillRanks): number =>
  Object.values(ranks).reduce((total, rank) => total + rank, 0);

export const pointsToOpen = (id: SkillId): number => (SKILLS[id].step - 1) * POINTS_PER_STEP;

/** Why this point can't be spent, or null if it can. A Hero has one Branch in the demo. */
export function spendRefusal(heroId: HeroId, ranks: SkillRanks, unspent: number, id: unknown): SpendRefusal | null {
  if (!isSkillId(id)) return 'unknownSkill';
  if (SKILLS[id].heroId !== heroId) return 'otherClass';
  if (isFreeSkill(id)) return 'freeSkill';
  if (unspent <= 0) return 'noPoints';
  if ((ranks[id] ?? 0) >= MAX_SKILL_RANK) return 'maxRank';
  if (spentPoints(ranks) < pointsToOpen(id)) return 'stepLocked';
  return null;
}

/** The active skills learned with points, in step order. */
const rankedActives = (ranks: SkillRanks): SkillId[] =>
  SKILL_IDS.filter((id) => SKILLS[id].kind === 'active' && !isFreeSkill(id) && (ranks[id] ?? 0) > 0).sort(
    (a, b) => SKILLS[a].step - SKILLS[b].step,
  );

/** The Hero's active skills: the free Class skill and every active learned with points. */
export const learnedActives = (heroId: HeroId, ranks: SkillRanks): SkillId[] => [...rankedActives(ranks), freeSkillOf(heroId)];

/** A legal order lists each learned active skill exactly once. */
export function isLegalOrder(heroId: HeroId, ranks: SkillRanks, order: readonly unknown[]): boolean {
  const learned = learnedActives(heroId, ranks);
  return order.length === learned.length && learned.every((id) => order.includes(id));
}

/**
 * The skill order for these ranks: each learned active once, keeping the order's choices.
 * Newly learned skills go ahead of the free Class skill, which always fires and would starve them,
 * and the free Class skill starts last.
 */
export function orderFor(heroId: HeroId, ranks: SkillRanks, order: readonly SkillId[] = []): SkillId[] {
  const learned = learnedActives(heroId, ranks);
  const kept = order.filter((id) => learned.includes(id));
  const free = freeSkillOf(heroId);
  const added = learned.filter((id) => id !== free && !kept.includes(id));
  const freeAt = kept.indexOf(free);
  if (freeAt === -1) return [...kept, ...added, free];
  return [...kept.slice(0, freeAt), ...added, ...kept.slice(freeAt)];
}

/** Part of a legal order: learned actives, each at most once. orderFor completes it. */
export const isPartialOrder = (heroId: HeroId, ranks: SkillRanks, order: readonly unknown[]): boolean => {
  const learned: readonly unknown[] = learnedActives(heroId, ranks);
  return new Set(order).size === order.length && order.every((id) => learned.includes(id));
};

// Save validation.

export const isRank = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value) && value >= 1 && value <= MAX_SKILL_RANK;

export const isRanks = (value: unknown): value is SkillRanks =>
  isRecord(value) && Object.entries(value).every(([id, rank]) => isSkillId(id) && !isFreeSkill(id) && isRank(rank));
