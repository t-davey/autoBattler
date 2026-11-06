import { isSkillId, MAX_SKILL_RANK, POINTS_PER_STEP, SKILL_IDS, SKILLS, type HeroId, type SkillId } from './content/skills';

export type SkillRanks = Readonly<Partial<Record<SkillId, number>>>;
export type SpendRefusal = 'unknownSkill' | 'otherClass' | 'noPoints' | 'stepLocked' | 'maxRank';

export const spentPoints = (ranks: SkillRanks): number =>
  Object.values(ranks).reduce((total, rank) => total + rank, 0);

export const pointsToOpen = (id: SkillId): number => (SKILLS[id].step - 1) * POINTS_PER_STEP;

/** Why this point can't be spent, or null if it can. A Hero has one Branch in the demo. */
export function spendRefusal(heroId: HeroId, ranks: SkillRanks, unspent: number, id: unknown): SpendRefusal | null {
  if (!isSkillId(id)) return 'unknownSkill';
  if (SKILLS[id].heroId !== heroId) return 'otherClass';
  if (unspent <= 0) return 'noPoints';
  if ((ranks[id] ?? 0) >= MAX_SKILL_RANK) return 'maxRank';
  if (spentPoints(ranks) < pointsToOpen(id)) return 'stepLocked';
  return null;
}

/** The learned active skills, in step order. */
export const learnedActives = (ranks: SkillRanks): SkillId[] =>
  SKILL_IDS.filter((id) => SKILLS[id].kind === 'active' && (ranks[id] ?? 0) > 0).sort(
    (a, b) => SKILLS[a].step - SKILLS[b].step,
  );

/** A legal order lists each learned active skill exactly once. */
export function isLegalOrder(ranks: SkillRanks, order: readonly unknown[]): boolean {
  const learned = learnedActives(ranks);
  return order.length === learned.length && learned.every((id) => order.includes(id));
}
