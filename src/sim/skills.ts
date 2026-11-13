import { isNumber, isRecord } from './guards';
import { isSkillId, MAX_SKILL_RANK, POINTS_PER_STEP, SKILL_IDS, SKILLS, type ClassId, type SkillId } from './content/skills';

export type SkillRanks = Readonly<Partial<Record<SkillId, number>>>;
export type SpendRefusal = 'unknownSkill' | 'otherClass' | 'freeSkill' | 'noPoints' | 'stepLocked' | 'maxRank';

export const isFreeSkill = (id: SkillId): boolean => SKILLS[id].free === true;

/** Each Class's free Class skill. */
export const freeSkillOf = (classId: ClassId): SkillId => SKILL_IDS.find((id) => isFreeSkill(id) && SKILLS[id].classId === classId)!;

export const spentPoints = (ranks: SkillRanks): number =>
  Object.values(ranks).reduce((total, rank) => total + rank, 0);

export const pointsToOpen = (id: SkillId): number => (SKILLS[id].step - 1) * POINTS_PER_STEP;

/** Points spent in one Branch, which open its deeper steps. */
export const spentIn = (ranks: SkillRanks, branch: string): number =>
  Object.entries(ranks).reduce((total, [id, rank]) => (SKILLS[id as SkillId].branch === branch ? total + (rank ?? 0) : total), 0);

/** Why this point can't be spent, or null if it can. */
export function spendRefusal(classId: ClassId, ranks: SkillRanks, unspent: number, id: unknown): SpendRefusal | null {
  if (!isSkillId(id)) return 'unknownSkill';
  if (SKILLS[id].classId !== classId) return 'otherClass';
  if (isFreeSkill(id)) return 'freeSkill';
  if (unspent <= 0) return 'noPoints';
  if ((ranks[id] ?? 0) >= MAX_SKILL_RANK) return 'maxRank';
  if (spentIn(ranks, SKILLS[id].branch) < pointsToOpen(id)) return 'stepLocked';
  return null;
}

/** The active skills learned with points, in step order. */
const rankedActives = (ranks: SkillRanks): SkillId[] =>
  SKILL_IDS.filter((id) => SKILLS[id].kind === 'active' && !isFreeSkill(id) && (ranks[id] ?? 0) > 0).sort(
    (a, b) => SKILLS[a].step - SKILLS[b].step,
  );

/** The Hero's active skills: the free Class skill and every active learned with points. */
export const learnedActives = (classId: ClassId, ranks: SkillRanks): SkillId[] => [...rankedActives(ranks), freeSkillOf(classId)];

/** The most active skills a Hero tries in a Battle. */
export const MAX_ORDERED_SKILLS = 3;

/** A legal order lists up to 3 learned active skills, each once. Learned skills can be left out. */
export function isLegalOrder(classId: ClassId, ranks: SkillRanks, order: readonly unknown[]): boolean {
  const learned: readonly unknown[] = learnedActives(classId, ranks);
  return order.length <= MAX_ORDERED_SKILLS && new Set(order).size === order.length && order.every((id) => learned.includes(id));
}

/** A new or respecced Hero's order: skills learned with points in step order, then the free Class skill, up to 3. */
export const defaultOrder = (classId: ClassId, ranks: SkillRanks): SkillId[] => learnedActives(classId, ranks).slice(0, MAX_ORDERED_SKILLS);

/**
 * The order once a skill is first learned: it joins if there's room, just ahead of the free Class skill,
 * which always has a target and would starve it. A full order is left for the player to change.
 */
export function withNewSkill(classId: ClassId, order: readonly SkillId[], learned: SkillId): SkillId[] {
  if (order.includes(learned) || order.length >= MAX_ORDERED_SKILLS) return [...order];
  const freeAt = order.indexOf(freeSkillOf(classId));
  if (freeAt === -1) return [...order, learned];
  return [...order.slice(0, freeAt), learned, ...order.slice(freeAt)];
}

// Save validation.

export const isRank = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value) && value >= 1 && value <= MAX_SKILL_RANK;

export const isRanks = (value: unknown): value is SkillRanks =>
  isRecord(value) && Object.entries(value).every(([id, rank]) => isSkillId(id) && !isFreeSkill(id) && isRank(rank));
