import type { ActNumber } from './world';

/** Flavour for the Live Log. Provisional, from docs/lore/act-2-fragments.md. */
const UNDERCROFT_CHEST_LINES: readonly string[] = [
  'Tallow on the hinges. Someone kept this chest opening easily.',
  'Inside the lid, a tally of names, each struck through.',
  'A tin measure at the bottom, scraped clean.',
  'It smells of the lamp-room down here. Nobody says so.',
  'The lantern was refilled. Nobody asked from where.',
];

const PLACEHOLDER_CHEST_LINES: readonly string[] = ['[placeholder] A chest. Its story is still to be written.'];

/** Flavour by Act, until the wilderness and the Ember Works have their own. */
export const CHEST_LINES_BY_ACT: Readonly<Record<ActNumber, readonly string[]>> = {
  1: PLACEHOLDER_CHEST_LINES,
  2: UNDERCROFT_CHEST_LINES,
  3: PLACEHOLDER_CHEST_LINES,
};
