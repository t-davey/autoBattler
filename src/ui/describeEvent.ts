import type { GameEvent } from '../sim';

const OUTCOME_LINES = {
  won: 'The Pack is broken. The Party stands.',
  lost: 'A Wipe. The dark closes in.',
  draw: 'Neither side yields. The Battle gutters out.',
} as const;

const EFFECT_LINES = {
  bleed: 'bleeds',
  poison: 'is poisoned',
} as const;

const TICK_VERBS = {
  bleed: 'bleeds',
  poison: 'sickens',
} as const;

const amount = (damage: number, absorbed: number): string => {
  const warded = absorbed > 0 ? ` (${Math.round(absorbed)} into a Ward)` : '';
  return `${Math.round(damage)}${warded}`;
};

/** One Live Log line for each event the sim reports. */
export function describeEvent(event: GameEvent): string {
  switch (event.type) {
    case 'attack': {
      const poison = event.damageType === 'poison' ? ' poison' : '';
      const crit = event.crit ? ' A critical hit!' : '';
      if (event.redirectedFromName) {
        return `${event.targetName} shoulders ${amount(event.damage, event.absorbed)} of the blow meant for ${event.redirectedFromName}.`;
      }
      return `${event.attackerName} hits ${event.targetName} for ${amount(event.damage, event.absorbed)}${poison}.${crit}`;
    }
    case 'effectDamage': {
      const shared = event.redirectedFromName ? `, sharing ${event.redirectedFromName}'s Poison` : '';
      return `${event.targetName} ${TICK_VERBS[event.effect]} for ${amount(event.damage, event.absorbed)}${shared}.`;
    }
    case 'skill':
      return `${event.unitName} uses ${event.skillName}.`;
    case 'heal':
      return `${event.targetName} recovers ${Math.round(event.amount)} health.`;
    case 'effect':
      return `${event.targetName} ${EFFECT_LINES[event.effect]}.`;
    case 'ward':
      return `${event.targetName} is warded for ${Math.round(event.amount)}.`;
    case 'death':
      return `${event.unitName} falls.`;
    case 'battleStarted':
      return `From the dark: ${event.enemyNames.join(', ')}.`;
    case 'battleEnded':
      return OUTCOME_LINES[event.outcome];
    case 'levelUp':
      return `${event.heroName} reaches level ${event.level}. A skill point waits.`;
  }
}
