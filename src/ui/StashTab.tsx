import type { HeroView, ItemView } from '../sim';
import { PartyStash, type StashRules } from './PartyStash';
import { emptyStashQuery } from './stashQuery';
import type { Dispatch } from './store';

export interface StashTabProps {
  readonly stash: readonly ItemView[];
  readonly heroes: readonly HeroView[];
  readonly dispatch: Dispatch;
  readonly seenItemId: number;
  readonly rules: StashRules;
}

export function StashTab({ stash, heroes, dispatch, seenItemId, rules }: StashTabProps) {
  return (
    <main className="stash-screen">
      <div className="stash-scaled">
        <PartyStash stash={stash} heroes={heroes} dispatch={dispatch} seenItemId={seenItemId} initial={emptyStashQuery} rules={rules} />
      </div>
    </main>
  );
}
