# autoBattler

An idle dungeon crawler: a Party descends on its own, fighting Battles and collecting loot, while the player plans builds between check-ins.

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
The smallest step of Battle time, in which each living Unit gets one chance to act.
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

**Elite**:
A stronger enemy in a pack with random modifiers and better loot.
_Avoid_: Champion, miniboss

### Party

**Hero**:
A player-owned Unit who levels up and equips gear.
_Avoid_: Character, adventurer, member

**Party**:
The 3 Heroes the player sends down together.
_Avoid_: Group, squad

**Class**:
The kind of Hero that determines their skill tree and role.
_Avoid_: Job, archetype

**Branch**:
One of the 3 themed sections of a Class's skill tree.
_Avoid_: Path, spec, discipline

**Oil**:
The resource a Hero's skills burn.
_Avoid_: Mana, energy

### Progress

**Run**:
A Party's stretch of descent between leaving Town and returning to it.
_Avoid_: Delve, expedition, dive

**Act**:
A themed stretch of the descent, ending in a Boss.
_Avoid_: Chapter, zone, region

**Floor**:
One generated level of an Act, made up of Rooms.
_Avoid_: Level, stage

**Room**:
One space on a Floor, holding a Battle, chest, trap, or shrine.
_Avoid_: Encounter, tile

**Wall**:
A Guardian or Boss that stops a Party until it grows stronger.
_Avoid_: Gate, blocker

**Check-in**:
A player's return to the game to read the Away Report and act on it.
_Avoid_: Session, visit

**Away Report**:
The summary of what a Party did while the game was closed.
_Avoid_: Offline report, summary screen

**Lamp**:
A point in the descent that a Party relights by beating its Guardian, and where it can resume after returning to Town.
_Avoid_: Checkpoint, waypoint, save point

**Guardian**:
The tough named enemy that guards a Lamp.
_Avoid_: Miniboss, gatekeeper

**Boss**:
The hand-designed enemy that ends an Act.
_Avoid_: Act guardian, final enemy

**Stance**:
The player's push or farm setting for how a Party moves between Lamps.
_Avoid_: Mode, strategy

**Difficulty Tier**:
A harder replay of the game's content with better loot.
_Avoid_: Difficulty level, new game plus

### Loot and economy

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
