// Placeholder renderer: proves sim → UI wiring. The real rendering stack is undecided.
import { simulateBattle, type BattleEvent, type BattleSetup, type UnitSpec } from '../sim';
import './style.css';

const unit = (id: string, hp: number, attack: number, attackInterval: number): UnitSpec => ({
  id,
  hp,
  attack,
  attackInterval,
});

const describeEvent = (event: BattleEvent): string =>
  event.type === 'attack'
    ? `Tick ${event.tick}: ${event.attackerId} hits ${event.targetId} for ${event.damage}`
    : `Tick ${event.tick}: ${event.unitId} dies`;

function render(root: HTMLElement, seed: number): void {
  const setup: BattleSetup = {
    seed,
    teams: {
      a: [unit('a-knight', 30, 4, 3), unit('a-archer', 15, 3, 2)],
      b: [unit('b-brute', 40, 6, 5), unit('b-rogue', 12, 2, 1)],
    },
  };
  const { winner, ticks, log } = simulateBattle(setup);

  const button = document.createElement('button');
  button.textContent = 'New seed';
  button.addEventListener('click', () => render(root, seed + 1));

  const summary = document.createElement('p');
  summary.textContent = `Seed ${seed}: ${winner ? `team ${winner} wins` : 'draw'} after ${ticks} ticks`;

  const list = document.createElement('ol');
  list.append(
    ...log.map((event) => {
      const item = document.createElement('li');
      item.textContent = describeEvent(event);
      return item;
    }),
  );

  root.replaceChildren(button, summary, list);
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app element missing from index.html');
render(root, 1);
