# Game design

A fusion of Diablo 2 and Clickpocalypse II, leaning towards idle play. Those games are inspiration for feel and structure: every name, character, class, item, and piece of art here is original to this game.

Terms are defined in [CONTEXT.md](../CONTEXT.md). Numbers are starting values to tune through play. The human decides anything listed under [Open questions](#open-questions) or missing from this document.

## Audience

A passion project for the creator and close friends, all on Windows. Single-player, with no servers.

## Core loop

The Party descends on its own while the player is away. The player returns to new loot, rethinks the build, and sends the Party back down.

- The player's skill is build planning. Light tending adds a small edge while watching.
- Anything the player can do by hand can also run by rule, so survival never requires watching.
- Each check-in offers at least one meaningful decision, such as a new item or skill point.

## Party and Heroes

- A Party is 3 Heroes chosen from a pool of 4 Classes. Duplicates are allowed.
- Heroes stand in the front or back row, which determines who they can reach and who can reach them.
- Levels raise stats automatically and grant skill points. The level cap starts at 60, with about level 25 reached by the end of the first Difficulty Tier.
- XP falls off on floors well below a Hero's level.
- One Party is active at a time. Others stay saved.

## Skills

- Each Class has a skill tree of about 12–15 skills.
- A Hero uses up to 3 active skills in an order the player sets, firing the first one available.
- Respecs cost gold and stay cheap, to encourage experimenting.

## Gear

- Each Hero has 6 slots: weapon, off-hand, helm, body, and two trinkets.
- Items come in common, magic, rare, and unique rarities. Non-uniques roll random Affixes.
- Uniques are hand-authored, and some change or grant skills.
- Auto-salvage rules exist from day one, and loot comparison stays manual, with no upgrade button.
- Heroes only change gear when the player equips it. New gear waits in the Stash, so walls mostly fall at check-ins.
- Later expansions, in order: sockets, then sets.

## Economy

- **Salvage** rerolls a single Affix on an item.
- **Gold** pays for respecs, a merchant, and a gamble vendor selling mystery items.
- **Town** is a menu rather than a place. Relit Lamps improve merchant stock and the gamble vendor, and brighten Town's art.

## World

One town survives around the Last Lamp, which holds back a rising dark. Parties descend to relight old Lamps in the depths. The dark is flavour: it never advances on a timer, and light is not a resource to manage.

The story reaches the player through short act introductions, boss lines, item descriptions, and away-report text.

There are 3 Acts of 10 floors each. Names are provisional.

| Act | Place | Enemies | Damage leaning |
|---|---|---|---|
| 1. The Undercroft | Flooded crypts beneath Town | The restless dead, fungal growth | Physical, poison |
| 2. The Ember Works | Abandoned foundries that once fed the Lamps | Burned workers, slag-creatures | Fire, physical |
| 3. The Lightless Court | A frozen palace | Those who chose the dark | Cold, corrupted holy |

### Floors

- A floor takes about 5 minutes: 8–12 rooms at 25–35 seconds each.
- Layouts regenerate from a Seed on each visit.
- The Party only has to find the stairs. Clearing side rooms is a behaviour rule, trading speed for extra loot.
- About two-thirds of rooms are Battles. The rest are chests, traps, and shrines with short-term buffs, which resolve automatically and add a flavour line to the log.

### Lamps and walls

- A Lamp sits every 3 floors, guarded by a Guardian. A Boss ends each Act, making 12 walls per Difficulty Tier.
- Each Party relights Lamps for itself, and they go dark again at each new Difficulty Tier.
- Each wall leans on a particular damage type or role.
- Guardians and Bosses respawn on each visit. The first kill guarantees a rare item.

### Why 2 weeks

Offline progress means about 300 hours of Party time in the first Difficulty Tier, while a clean pass through all 30 floors takes about 2 hours. Power walls fill the gap: most of that time goes to farming, and about 35 check-ins against 12 walls means breaking through one about every 3 check-ins. Farming going stale is the main risk, so loot and Elites have to stay interesting.

### Loot sources

Enemy levels are fixed per floor and Difficulty Tier, and deeper floors drop better loot. Specific Guardians and Bosses favour specific uniques, and each enemy family leans towards certain item types, so older areas stay worth farming.

## Runs

- Battles happen inside a dungeon crawl: the Party moves through a generated map of rooms.
- Health carries between Battles and recovers slowly between rooms, so a floor wears the Party down.
- The Party shares a Belt of healing potions, cleansing tonics, and escape scrolls. Each type has a maximum and refills free in Town.
- The player can use consumables at any time, and rules use them when the player is away.
- Loot goes straight to the Stash. When the Stash is full, the lowest-value items are salvaged.

## Combat

- Damage types are physical, fire, cold, poison, and holy, with matching resistances.
- Enemies come in families with front and back-row roles, plus Elite packs with random modifiers and better loot, plus hand-designed bosses (simple at first).

## Setbacks

- A wipe costs only time, with no gold, XP, or item penalty.
- Player rules or a wipe return the Party to Town. The trip is instant and free, and the Party resumes from the last Lamp.
- The player sets a Stance and can choose any lit Lamp to work from:
  - **Farm** repeats from the chosen Lamp to the next one, including that Lamp's Guardian once beaten.
  - **Push** falls back one Lamp after 3 wipes, farms there, and retries whenever a Hero levels up. The player sees a note on returning, and the away report explains failures, such as "2 wipes, mostly fire damage".

## Long term

- There are 3 Difficulty Tiers of about equal length, about 6 weeks in total for one Party. Each replays the content with better loot and a resistance penalty.
- Beating the final Boss unlocks the next Difficulty Tier. A Party can return to earlier ones freely, with its Lamps still lit there.
- After the final Difficulty Tier, the player starts fresh Parties that share the Stash. Stash items have level requirements, and each Party that finishes the game earns a small account-wide bonus.
- Endless depth is a later expansion, as is a fourth Act.

## Time and pacing

- Offline progress runs at the full rate, capped at 12 hours.
- Play runs in real time, with an optional 2x once balance holds up.
- The target is about 2 weeks to finish the first Difficulty Tier, with 2–3 short check-ins a day.

## Presentation

- UI-first: panels, text, icons, and a simple tile map, with room for pixel art later.
- A dashboard while the Party runs, tabs for planning, and a "while you were away" report.
- Grim gothic tone.
- Audio starts silent, with a few key effects such as a rare drop added later.
- "autoBattler" is the working title.

## Release

- Windows installer with auto-update through GitHub Releases. Friends see a one-time SmartScreen warning.
- Closing the window stops the game, and it catches up on the next launch.
- Save wipes are expected until 1.0, so saves carry no migration promise yet.

## First playable

The full loop, built thin, to test whether coming back to loot feels good: all of Act 1 with its 3 Guardians and Boss, placeholder Classes, rarity and Affix loot, auto-salvage, Town, and the offline report. Judge it over a few real days of check-ins, since a single session can't show whether returning feels good.

## Open questions

- **Classes:** the roster and each Class's identity. Proposed and unconfirmed: Penitent (front, melee, trades health for power), Huntsman (either row, physical with traps and bleeds), Hexer (back, curses and damage over time), Lamplighter (back, wards and heals with light).
- **Rendering technology:** the stack behind the UI-first presentation.
