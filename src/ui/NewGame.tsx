import { useState } from 'react';
import { CLASS_IDS, type ClassId } from '../sim';

/** From the design's Classes table: what each Class is for, so the choice is informed. */
const CLASS_TEXT: Readonly<Record<ClassId, { readonly name: string; readonly line: string }>> = {
  'sin-eater': { name: 'Sin-Eater', line: 'Front Row. A tank and bruiser who takes harm into itself and turns it into power.' },
  warrener: { name: 'Warrener', line: 'Either Row. Steady damage from traps and bleeds, with skills that change by Row.' },
  hexer: { name: 'Hexer', line: 'Back Row. Curses and rot: weakens enemies, with damage that builds slowly.' },
  lamplighter: { name: 'Lamplighter', line: 'Back Row. Wards and heals, or burns with the same light.' },
};

const STARTING_PARTY: readonly ClassId[] = ['sin-eater', 'warrener', 'lamplighter'];

/** Picks the Party's 3 Classes, duplicates allowed. A Party is fixed once created. */
export function NewGame({ onStart }: { onStart: (party: readonly ClassId[]) => void }) {
  const [party, setParty] = useState<readonly ClassId[]>(STARTING_PARTY);
  const choose = (slot: number, classId: ClassId) => setParty(party.map((current, index) => (index === slot ? classId : current)));
  return (
    <main className="new-game">
      <section className="panel" aria-label="New Party">
        <h2>A new Party</h2>
        <p>The Council sends three. Pick each one's Class: any trio can finish, and a Class may go twice or three times. The Party can't change once it sets out.</p>
        <ol className="new-game-slots">
          {party.map((chosen, slot) => (
            <li key={slot}>
              <fieldset>
                <legend>Hero {slot + 1}</legend>
                {CLASS_IDS.map((classId) => (
                  <label key={classId} className={chosen === classId ? 'class-choice class-choice-chosen' : 'class-choice'}>
                    <input type="radio" name={`hero-${slot}`} aria-label={`Hero ${slot + 1}: ${CLASS_TEXT[classId].name}`} checked={chosen === classId} onChange={() => choose(slot, classId)} />
                    <strong>{CLASS_TEXT[classId].name}</strong>
                    <span className="hint">{CLASS_TEXT[classId].line}</span>
                  </label>
                ))}
              </fieldset>
            </li>
          ))}
        </ol>
        <button type="button" className="lit-button" onClick={() => onStart(party)}>
          Form the Party
        </button>
      </section>
    </main>
  );
}
