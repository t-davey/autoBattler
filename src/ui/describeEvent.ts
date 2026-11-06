import type { GameEvent } from '../sim';

const OUTCOME_LINES = {
  won: 'The Pack is broken. The Party stands.',
  lost: 'The Party falls. The dark closes in.',
  draw: 'Neither side yields. The Battle gutters out.',
} as const;

/** One Live Log line for each event the sim reports. */
export function describeEvent(event: GameEvent): string {
  switch (event.type) {
    case 'attack': {
      const poison = event.damageType === 'poison' ? ' poison' : '';
      const crit = event.crit ? ' A critical hit!' : '';
      return `${event.attackerName} hits ${event.targetName} for ${Math.round(event.damage)}${poison}.${crit}`;
    }
    case 'death':
      return `${event.unitName} falls.`;
    case 'battleStarted':
      return `From the dark: ${event.enemyNames.join(', ')}.`;
    case 'battleEnded':
      return OUTCOME_LINES[event.outcome];
  }
}
