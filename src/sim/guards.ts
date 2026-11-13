/** Type guards shared by the save validators beside each state type. */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const isOptionalNumber = (value: unknown): boolean => value === undefined || isNumber(value);
export const isString = (value: unknown): boolean => typeof value === 'string';
