# autoBattler

An idle dungeon crawler: a Party ventures out on its own, fighting Battles and collecting loot, while the player plans builds between check-ins.

## Language

### Battles

**Unit**:
A single fighter in a Battle, on either side.
_Avoid_: Combatant, minion

**Team**:
The Units fighting on one side of a Battle.
_Avoid_: Squad, side

**Battle**:
One complete clash between two Teams, ending in a win for one Team or a draw.
_Avoid_: Match, fight, combat

**Tick**:
The smallest step of game time, 100 ms; within a Battle, each living Unit gets one chance to act in it.
_Avoid_: Turn, frame, round

**Seed**:
The number that, together with the starting state and player actions, fully determines how play unfolds.
_Avoid_: Random state

**Battle Log**:
The ordered record of everything that happened in a Battle.
_Avoid_: History, replay, event stream

**Wipe**:
The death of every Hero in a Party.
_Avoid_: Party death, game over

**Pack**:
The group of enemies a Party meets in a Battle, drawn from one Family.
_Avoid_: Group, wave, mob

**Family**:
A set of related enemies that fill front and back-Row roles together.
_Avoid_: Faction, type

**Elite**:
A stronger enemy in a Pack with random modifiers and better loot.
_Avoid_: Champion, miniboss

### Party

**Hero**:
A player-owned Unit who levels up and equips gear.
_Avoid_: Character, adventurer, member

**Rise**:
What a Hero who fell in a won Battle does when the Battle ends, returning at reduced health.
_Avoid_: Revive, resurrect

**Party**:
The 3 Heroes the player sends out together.
_Avoid_: Group, squad

**Class**:
The kind of Hero that determines their skill tree and role.
_Avoid_: Job, archetype

**Warrener**:
The Class that replaces the Huntsman. The code and other docs say Huntsman until it is renamed.
_Avoid_: Huntsman, in new writing

**Branch**:
One of the 3 themed sections of a Class's skill tree.
_Avoid_: Path, spec, discipline

**Oil**:
The resource a Hero's skills burn.
_Avoid_: Mana, energy

**Row**:
The front or back line a Unit stands in during a Battle.
_Avoid_: Rank, line, position

**Damage type**:
The kind of harm a hit deals: physical, fire, cold, poison, or holy.
_Avoid_: Element

**Resistance**:
A percentage that reduces damage of one Damage type, capped at 75%.
_Avoid_: Defence, ward

**Armour**:
A stat that reduces physical damage, on top of physical Resistance.
_Avoid_: Defence, protection

**Reach**:
Whether a Unit is melee, limited to the enemy front Row, or ranged, not limited by Row.
_Avoid_: Range

**Targeting**:
Which Row a Unit picks from among those its Reach allows: the front Row while it lives, or either.
_Avoid_: Aggro, priority

**XP falloff**:
The smaller XP a Hero earns on a Floor well below its level.
_Avoid_: XP penalty, level penalty

**Skill point**:
What a Hero earns each level and spends to raise a skill.
_Avoid_: Talent point, ability point

**Skill rank**:
How far a skill has been raised, from 1 to 5.
_Avoid_: Skill level, tier

**Step**:
A skill's depth in its Branch, opened by points spent in that Branch.
_Avoid_: Tier, layer

**Skill order**:
The order a Hero tries its learned active skills in, set by the player.
_Avoid_: Priority list, rotation

**Usefulness condition**:
The built-in test that keeps a skill from firing when it would do nothing.
_Avoid_: Trigger, requirement

**Cooldown**:
The Ticks before a skill can be used again.
_Avoid_: Recharge

**Respec**:
Refunding all of a Hero's skill points to spend them again.
_Avoid_: Reset, rebuild

**Effect**:
A timed condition on a Unit: Bleed, Poison, or Ward.
_Avoid_: Status, buff, debuff

**Bleed**:
Physical damage over time that ignores Armour.
_Avoid_: Wound, dot

**Poison**:
Stacking poison damage over time, up to 5 stacks on a Unit.
_Avoid_: Venom, dot

**Ward**:
A temporary layer that absorbs damage of any type before health.
_Avoid_: Shield, barrier

**Live Log**:
The dashboard's rolling record of live play, combining Battle Logs with lines from other Rooms.
_Avoid_: Activity feed, combat log

### Progress

**Run**:
A Party's stretch of play between leaving Town and returning to it.
_Avoid_: Delve, expedition, dive

**Act**:
A themed stretch of the game's world, ending in its last Guardian.
_Avoid_: Chapter, zone, region

**Floor**:
One generated level of an Act, made up of Rooms.
_Avoid_: Level, stage

**Room**:
One space on a Floor, holding a Battle, chest, trap, or shrine.
_Avoid_: Encounter, tile

**Floor level**:
The level a Floor's enemies count as, which sets when XP falloff begins.
_Avoid_: Stage level, zone level

**Way in**:
The side of a Room the Party entered by, shown in the Battle scene as a door or stairs.
_Avoid_: Entrance, spawn point

**Way out**:
The side of a Room the Party leaves by, always lit so the scene shows where it is heading.
_Avoid_: Exit, goal

**Wall**:
A Guardian that stops a Party until it grows stronger.
_Avoid_: Gate, blocker

**Phase**:
A stage of a Guardian's Battle with its own actions, entered at a share of its health.
_Avoid_: Stage, form

**Best attempt**:
The lowest health a Guardian reached in the time an Away Report covers.
_Avoid_: High score, record

**Catch-up**:
Running a player's absence, or the time a check-in paused, through the same rules as live play, up to 12 hours, and reporting it in an Away Report.
_Avoid_: Offline progress, fast-forward

**Test speed**:
A temporary control that runs live play at 2x, 5x, or 10x, for testing the demo.
_Avoid_: Fast-forward, time skip

**Party time**:
The time a Party has spent playing, live or in catch-up, as opposed to time on the player's clock.
_Avoid_: Game time, play time

**Setback**:
A Wipe or a draw that returns the Party to Town.
_Avoid_: Defeat, loss, failure

**Fall back**:
To stop challenging a Wall after 3 Setbacks, and farm until the Party grows stronger or its build changes.
_Avoid_: Retreat, regroup

**Check-in**:
A player's return to the game to read the Away Report and act on it.
_Avoid_: Session, visit

**Away Report**:
The summary of what a Party did while the player was away, with the game closed or its window covered or minimized, along with any time a check-in paused.
_Avoid_: Offline report, summary screen

**Finding**:
One entry in an Away Report that gives the player something to act on, such as Setbacks, the loot found, or unspent skill points.
_Avoid_: Alert, task

**Run call**:
An order the player gives a Party during a Run, such as returning to Town.
_Avoid_: Command, intervention

**Lamp**:
A point in an Act that a Party relights by beating its Guardian, and where it can resume after returning to Town.
_Avoid_: Checkpoint, waypoint, save point

**Barrier Lamp**:
A Lamp in the wilderness of Act 1, part of the ward that keeps the Dark from reaching Town.
_Avoid_: Beacon

**Guardian**:
A tough, named, hand-designed automaton: one guards each Lamp, and the last in an Act ends it, making 12 per Difficulty Tier.
_Avoid_: Boss, miniboss, gatekeeper, final enemy

**Stance**:
The player's push or farm setting for how a Party moves between Lamps.
_Avoid_: Mode, strategy

**Difficulty Tier**:
A harder replay of the game's content with better loot.
_Avoid_: Difficulty level, new game plus

### Story

**The Rendering**:
The hidden truth at the heart of the story: Oil is rendered from the dead.
_Avoid_: The twist, the secret

**Fragment**:
A short piece of story text that the player meets in play, such as a ledger, an item description, or an Away Report line.
_Avoid_: Lore entry, codex entry

**The Dark**:
What envelops the world, held back only by Oil Lamps. It reanimates the dead and is never explained.
_Avoid_: Darkness, the shadow

**The Penitents' Order**:
The lay order Sin-Eaters belong to, descended from the builders of the automata. Most members don't know the Rendering.
_Avoid_: Church, cult

**Synod**:
The Penitents' Order's governing body, which knows the Rendering.
_Avoid_: Council

**Spigot burner**:
A small flame fed from a pipe on a Room's wall. It gives light but doesn't hold back the Dark, as a Lamp does.
_Avoid_: Sconce, Lamp, torch

**Tallow candle**:
A candle left in a burial niche in the Undercroft.
_Avoid_: Votive

**Foxfire**:
The cold glow of fungal growth in the Undercroft.
_Avoid_: Glowshroom

**Town Council**:
The body that sends Parties out to relight Lamps.
_Avoid_: Synod

### Loot and economy

**Item**:
A piece of gear a Hero can equip, or that waits in the Stash.
_Avoid_: Equipment piece, drop

**Rarity**:
How rare an Item is: common, magic, or rare. It sets how many Affixes the Item rolls.
_Avoid_: Quality, grade

**Slot**:
The place on a Hero an Item goes: weapon, body, or trinket.
_Avoid_: Equip location, gear position

**Level requirement**:
The Hero level an Item needs before it can be equipped.
_Avoid_: Item level, minimum level

**Affix**:
A randomly rolled property on an item.
_Avoid_: Enchantment

**Stash**:
The storage where loot lands, shared by all of the player's Parties.
_Avoid_: Inventory, bank

**Salvage**:
The crafting material gained by breaking down items.
_Avoid_: Scrap, dust

**Belt**:
The Party's shared, capped supply of consumables.
_Avoid_: Potion bag, quick slots

**Town**:
The menu where a Party refills its Belt and Oil, and the player spends gold and Salvage.
_Avoid_: Hub, camp
