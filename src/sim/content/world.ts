/** The first Difficulty Tier's map: 3 Acts of 20 Floors, with a Lamp and its Guardian every 5 Floors. */

export const FLOORS_PER_ACT = 20;
export const FLOORS_PER_LAMP = 5;
export const LAMPS_PER_ACT = FLOORS_PER_ACT / FLOORS_PER_LAMP;

export type ActNumber = 1 | 2 | 3;

export interface ActDefinition {
  readonly act: ActNumber;
  readonly name: string;
  readonly place: string;
  /** True while the Act's enemies and story are stand-ins. */
  readonly placeholder: boolean;
}

export const ACTS: readonly ActDefinition[] = [
  { act: 1, name: 'The Wilderness', place: 'The dark wilderness around Town, where the Barrier Lamps stand', placeholder: true },
  { act: 2, name: 'The Undercroft', place: 'Flooded crypts beneath Town', placeholder: false },
  { act: 3, name: 'The Ember Works', place: 'Foundries that still refine the Lamps’ Oil', placeholder: true },
];

export interface LampDefinition {
  readonly act: ActNumber;
  /** 1–4 within its Act. */
  readonly lamp: number;
  /** The depth of the Floor whose last Room holds the Guardian. */
  readonly depth: number;
  readonly guardianName: string;
  /** The depth the Guardian's stats were tuned at. It scales from there to its own depth. */
  readonly tunedDepth: number;
  readonly placeholder: boolean;
}

/** Real Guardians, by "act-lamp". Every other Lamp gets a placeholder. */
const BUILT_GUARDIANS: Readonly<Record<string, { readonly name: string; readonly tunedDepth: number }>> = {
  // Tuned for the demo's Floor 5, before the Undercroft moved to Act 2.
  '2-1': { name: 'The Mouldering Warden', tunedDepth: 5 },
};

export const depthOf = (act: ActNumber, floor: number): number => (act - 1) * FLOORS_PER_ACT + floor;

export const LAMPS: readonly LampDefinition[] = ACTS.flatMap(({ act }) =>
  Array.from({ length: LAMPS_PER_ACT }, (_, index): LampDefinition => {
    const lamp = index + 1;
    const depth = depthOf(act, lamp * FLOORS_PER_LAMP);
    const built = BUILT_GUARDIANS[`${act}-${lamp}`];
    return built
      ? { act, lamp, depth, guardianName: built.name, tunedDepth: built.tunedDepth, placeholder: false }
      : { act, lamp, depth, guardianName: `Placeholder Guardian (Act ${act}, Lamp ${lamp})`, tunedDepth: depth, placeholder: true };
  }),
);

export const MAX_DEPTH = ACTS.length * FLOORS_PER_ACT;
