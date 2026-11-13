import { ACTS, floorAt, type GameEvent } from '../sim';
import { floorLabel } from './floorLabel';

const OUTCOME_LINES = {
  won: 'The enemy is broken. The Party stands.',
  lost: 'The dark closes in.',
  draw: 'Neither side yields. The Battle gutters out.',
} as const;

const EFFECT_LINES = {
  bleed: 'bleeds',
  poison: 'is poisoned',
  burn: 'catches fire',
  slow: 'is slowed',
  curse: 'is Cursed',
} as const;

const TICK_VERBS = {
  bleed: 'bleeds',
  poison: 'sickens',
  burn: 'burns',
} as const;

const ROOM_LINES = {
  battle: 'Something stirs in the next Room.',
  chest: 'A chest in the next Room. The Party searches it.',
  stairs: 'The stairs lie ahead, and something waits by them.',
  guardian: 'The Guardian waits in the next Room. The air is thick with spores.',
} as const;

const TOWN_LINES = {
  setback: 'The Party wakes in Town.',
  turnedBack: 'The Party turns back before the Guardian, and returns to Town.',
  lampRelit: 'The Party returns to Town by the new light.',
  guardianFell: 'The Party returns to Town. The Lamp still burns.',
} as const;

const amount = (damage: number, absorbed: number): string => {
  const warded = absorbed > 0 ? ` (${Math.round(absorbed)} into a Ward)` : '';
  return `${Math.round(damage)}${warded}`;
};

/** One Live Log line for each event the sim reports. */
export function describeEvent(event: GameEvent): string {
  switch (event.type) {
    case 'attack': {
      const kind = event.damageType === 'physical' ? '' : ` ${event.damageType}`;
      const crit = event.crit ? ' A critical hit!' : '';
      if (event.redirectedFromName) {
        return `${event.targetName} shoulders ${amount(event.damage, event.absorbed)} of the blow meant for ${event.redirectedFromName}.`;
      }
      return `${event.attackerName} hits ${event.targetName} for ${amount(event.damage, event.absorbed)}${kind}.${crit}`;
    }
    case 'effectDamage': {
      const shared = event.redirectedFromName ? `, sharing ${event.redirectedFromName}'s Poison` : '';
      return `${event.targetName} ${TICK_VERBS[event.effect]} for ${amount(event.damage, event.absorbed)}${shared}.`;
    }
    case 'dodge':
      return `${event.targetName} dodges ${event.attackerName}'s attack.`;
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
    case 'phaseChanged':
      return `${event.unitName} enters its second Phase.`;
    case 'action':
      return `${event.unitName} uses ${event.actionName}.`;
    case 'battleStarted':
      return `From the dark: ${event.enemyNames.join(', ')}.`;
    case 'battleEnded':
      return OUTCOME_LINES[event.outcome];
    case 'levelUp':
      return `${event.heroName} reaches level ${event.level}. A skill point waits.`;
    case 'heroRose':
      return `${event.heroName} rises, barely.`;
    case 'floorEntered':
    {
      const { act, floor, actName } = floorAt(event.floor);
      const intro = floor === 1 && ACTS[act - 1]?.placeholder ? ' [placeholder: this Act’s introduction]' : '';
      return `${floorLabel(event.floor)}: ${actName}.${intro}`;
    }
    case 'roomEntered':
      return ROOM_LINES[event.kind];
    case 'chestOpened':
      return event.line;
    case 'itemFound':
      return `Found a ${event.item.rarity}: ${event.item.name}.`;
    case 'wipe':
      return `A Wipe on ${floorLabel(event.floor)}, before ${event.enemyName}.`;
    case 'draw':
      return `A draw on ${floorLabel(event.floor)}, against ${event.enemyName}. The Party withdraws.`;
    case 'returnedToTown':
      return TOWN_LINES[event.reason];
    case 'partySent':
      return 'The Party goes down again.';
    case 'pickTaken': {
      const passed = event.offers.filter((offer) => offer.id !== event.taken.id).map((offer) => offer.name);
      const marker = event.taken.placeholder ? '[placeholder] ' : '';
      const over = passed.length > 0 ? `, over ${passed.join(' and ')}` : '';
      return `${marker}The Party takes ${event.taken.name}: ${event.taken.line} until it returns to Town${over}.`;
    }
    case 'fellBack':
      return 'One Setback too many. The Party will turn back before the Guardian until it grows stronger.';
    case 'retryingGuardian':
      return 'Stronger now. The Party will try the Guardian again.';
    case 'guardianFell':
      return 'The way to the Lamp is clear.';
    case 'lampRelit':
      return 'The Lamp is relit.';
  }
}
