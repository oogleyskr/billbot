# D&D 5e Skill

Use the D&D 5e CLI for one-shot queries, rule lookups, and character creation help.

## Installation

```bash
npm install -g @openclaw/dnd5e-cli
```

## Usage

```bash
# Look up a rule
dnd5e rule <rule-name>

# Look up a class
dnd5e class <class-name>

# Look up a race
dnd5e race <race-name>

# Look up a spell
dnd5e spell <spell-name>

# Help
dnd5e --help
```

## Core Rules Reference

### Ability Scores

- **Strength (STR):** Physical power, melee attacks, carrying capacity
- **Dexterity (DEX):** Agility, reflexes, ranged attacks, AC with light armor
- **Constitution (CON):** Endurance, hit points, resistance to poison/disease
- **Intelligence (INT):** Reasoning, memory, arcana, history
- **Wisdom (WIS):** Perception, insight, intuition, survival
- **Charisma (CHA):** Persuasion, leadership, deception, intimidation

### Skills (associated with abilities)

- **Athletics (STR):** Climbing, jumping, swimming
- **Acrobatics (DEX):** Balance, tumbling, escaping restraints
- **Sleight of Hand (DEX):** Picking pockets, palming objects
- **Stealth (DEX):** Hiding, moving quietly
- **Arcana (INT):** Magic, spells, magical creatures
- **History (INT):** Past events, military history, famous people
- **Investigation (INT):** Finding clues, analyzing evidence
- **Nature (INT):** Animals, plants, terrain, weather
- **Religion (INT):** Deities, rituals, religious lore
- **Animal Handling (WIS):** Calming, training animals
- **Insight (WIS):** Reading people, detecting lies
- **Medicine (WIS):** Diagnosing illnesses, first aid
- **Perception (WIS):** Finding hidden things, noticing details
- **Survival (WIS):** Tracking, finding food/water, avoiding hazards
- **Deception (CHA):** Lying, disguising intentions
- **Intimidation (CHA):** Threatening, bullying
- **Performance (CHA):** Singing, acting, dancing
- **Persuasion (CHA):** Convincing, negotiating

### Combat Actions

- **Attack:** Make one weapon attack
- **Cast a Spell:** Cast a spell with casting time of 1 action
- **Dash:** Double movement speed this turn
- **Disengage:** Move without provoking opportunity attacks
- **Dodge:** Advantage on DEX saves, attackers have disadvantage
- **Help:** Grant advantage on ability check or attack against target within 5ft
- **Hide:** Make a Stealth check
- **Ready:** Pre-action with specific trigger
- **Search:** Search an area, gain advantage on Perception checks
- **Use an Object:** Interact with non-weapon object

### Combat Bonus Actions

- **Cunning Action (Rogue):** Move, dash, disengage, or hide as bonus action
- **Bonus Action Spells:** Only if main action is cantrip
- **Class-specific:** Many classes grant bonus actions

### Combat Reactions

- **Opportunity Attack:** When enemy leaves reach
- **Counterspell:** When enemy casts spell within 60ft
- **Shield:** +5 AC until start of next turn
- **Ready Action:** When trigger occurs

### Proficiency

- **Proficient:** Add proficiency bonus to roll
- **Expertise:** Double proficiency bonus for selected skills

### Advantage/Disadvantage

- **Advantage:** Roll 2d20, take highest
- **Disadvantage:** Roll 2d20, take lowest

### Saving Throws

- **Strength Save (STR):** Resist physical effects
- **Dexterity Save (DEX):** Dodge area effects, avoid traps
- **Constitution Save (CON):** Resist poison/disease, hold breath
- **Intelligence Save (INT):** Resist mental effects
- **Wisdom Save (WIS):** Resist charm, fear, illusion
- **Charisma Save (CHA):** Resist possession, mind control

### Spell Slots by Level

| Level | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th | 8th | 9th |
| ----- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1     | 2   | -   | -   | -   | -   | -   | -   | -   | -   |
| 2     | 3   | -   | -   | -   | -   | -   | -   | -   | -   |
| 3     | 4   | 2   | -   | -   | -   | -   | -   | -   | -   |
| 4     | 4   | 3   | -   | -   | -   | -   | -   | -   | -   |
| 5     | 4   | 3   | 2   | -   | -   | -   | -   | -   | -   |
| 6     | 4   | 3   | 3   | -   | -   | -   | -   | -   | -   |
| 7     | 4   | 3   | 3   | 2   | -   | -   | -   | -   | -   |
| 8     | 4   | 3   | 3   | 3   | -   | -   | -   | -   | -   |
| 9     | 4   | 3   | 3   | 3   | 2   | -   | -   | -   | -   |
| 10    | 4   | 3   | 3   | 3   | 2   | 1   | -   | -   | -   |
| 11    | 4   | 3   | 3   | 3   | 2   | 1   | -   | -   | -   |
| 12    | 4   | 3   | 3   | 3   | 2   | 1   | 1   | -   | -   |
| 13    | 4   | 3   | 3   | 3   | 2   | 1   | 1   | -   | -   |
| 14    | 4   | 3   | 3   | 3   | 2   | 1   | 1   | 1   | -   |
| 15    | 4   | 3   | 3   | 3   | 2   | 1   | 1   | 1   | -   |
| 16    | 4   | 3   | 3   | 3   | 2   | 1   | 1   | 1   | 1   |
| 17    | 4   | 3   | 3   | 3   | 2   | 1   | 1   | 1   | 1   |
| 18    | 4   | 3   | 3   | 3   | 3   | 1   | 1   | 1   | 1   |
| 19    | 4   | 3   | 3   | 3   | 3   | 2   | 1   | 1   | 1   |
| 20    | 4   | 3   | 3   | 3   | 3   | 2   | 2   | 1   | 1   |

### Proficiency Bonus by Level

| Level | Bonus |
| ----- | ----- |
| 1-4   | +2    |
| 5-8   | +3    |
| 9-12  | +4    |
| 13-16 | +5    |
| 17-20 | +6    |

## Classes (1st Level Features)

### Fighter

- **Fighting Style:** Choose one (Archery, Defense, Dueling, Great Weapon Fighting, Protection, Two-Weapon Fighting)
- **Second Wind:** Bonus action to heal 1d10 + fighter level HP

### Wizard

- **Arcane Recovery:** Recover spell slots equal to half wizard level (max 1st level slots) after short rest
- **Spellbook:** Record spells, copy from scrolls/other sources

### Cleric

- **Divine Domain:** Choose domain (Knowledge, Life, Light, Nature, Tempest, Trickery, War, etc.)
- **Channel Divinity:** Turn undead, destroy undead, or domain-specific effect

### Rogue

- **Expertise:** Double proficiency bonus for two skills
- **Sneak Attack:** 1d6 damage once per turn when advantage or ally within 5ft of target
- **Thieves' Cant:** Secret language of rogues

### Monk

- **Unarmored Defense:** AC = 10 + DEX + WIS while not wearing armor
- **Martial Arts:** Unarmed strike as bonus action, +1d4 damage

### Paladin

- **Divine Smite:** Spend spell slot to deal radiant damage on melee hit
- **Divine Sense:** Detect celestial/planar/undead/evil creatures
- **Lay on Hands:** Pool of HP to heal or cure disease/poison

### Ranger

- **Favored Enemy:** Choose enemy type, gain advantage on related checks
- **Natural Explorer:** Choose terrain, gain advantage on navigation/finding food/water

### Warlock

- **Pact Magic:** Spell slots recharge on short rest
- **Eldritch Invocations:** Custom spell-like abilities
- **Pact Boon:** Pact Weapon, Pact Tome, or Pact Bond (familiar/polar bear)

### Sorcerer

- **Sorcerous Origin:** Choose origin (Draconic, Wild Magic, Shadow, Storm, etc.)
- **Font of Magic:** Convert spell slots to sorcery points and vice versa

### Druid

- **Druidic:** Secret language of druids
- **Wild Shape:** Transform into beasts (2x/day at 2nd level)

## Races

### Human

- **Ability Score:** +1 to all six abilities
- **Speed:** 30ft
- **Languages:** Common + 1 extra

### Elf

- **Ability Score:** +2 Dexterity
- **Speed:** 30ft
- **Darkvision:** 60ft
- **Fey Ancestry:** Advantage on CHA saves vs. charm
- **Trance:** Meditate 4 hours instead of sleeping
- **Languages:** Common, Elvish

### Dwarf

- **Ability Score:** +2 Constitution
- **Speed:** 25ft
- **Darkvision:** 60ft
- **Dwarven Resilience:** Advantage on CON saves vs. poison, resistance to poison damage
- **Dwarven Training:** Proficient with axe, hammer, light hammer
- **Languages:** Common, Dwarvish

### Halfling

- **Ability Score:** +2 Dexterity
- **Speed:** 25ft
- **Lucky:** Reroll 1s on attack rolls, ability checks, saving throws
- **Brave:** Advantage on saves vs. frightened
- **Halfling Nimbleness:** Move through space of larger creatures
- **Languages:** Common, Halfling

### Dragonborn

- **Ability Score:** +2 Strength, +1 Charisma
- **Speed:** 30ft
- **Draconic Ancestry:** Damage type + breath weapon
- **Breath Weapon:** 2d6 damage (save for half) recharge 5-6
- **Damage Resistance:** Resistance to dragon ancestor type
- **Languages:** Common, Draconic

### Gnome

- **Ability Score:** +2 Intelligence
- **Speed:** 25ft
- **Darkvision:** 60ft
- **Gnome Cunning:** Advantage on INT/WIS/CHA saves vs. magic
- **Languages:** Common, Gnomish

### Half-Elf

- **Ability Score:** +2 Charisma, +1 to two others
- **Speed:** 30ft
- **Darkvision:** 60ft
- **Fey Ancestry:** Advantage on CHA saves vs. charm
- **Skill Versatility:** Proficient in two skills
- **Languages:** Common, Elvish + 1 other

### Half-Orc

- **Ability Score:** +2 Strength, +1 Constitution
- **Speed:** 30ft
- **Darkvision:** 60ft
- **Savage Attacks:** Roll max die on crits with melee weapons
- **Languages:** Common, Orc

### Tiefling

- **Ability Score:** +2 Charisma, +1 Intelligence
- **Speed:** 30ft
- **Darkvision:** 60ft
- **Hellish Resistance:** Resistance to fire damage
- **Infernal Legacy:** Can cast detect magic, hellish rebuke, darkness
- **Languages:** Common, Infernal

## Basic Combat Example

**Round 1:**

1. DM describes scene
2. Roll initiative (1d20 + DEX modifier)
3. Turn order from highest to lowest

**Player Turn:**

- Move up to speed (30ft for most)
- Action: Attack, Cast Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use Object
- Bonus Action (if class feature)
- Reaction (if trigger occurs)

**Attack Roll:**

```
1d20 + ability modifier + proficiency bonus vs. AC
```

**Damage Roll:**

```
Weapon damage + ability modifier (usually STR or DEX)
```

**Critical Hit:**

- Roll all damage dice twice
- Add modifiers once

## References

- [D&D 5e SRD](https://www.dndbeyond.com/srd)
- [D&D Beyond](https://www.dndbeyond.com)
- [5e SRD on 5e.d20srd.org](https://5e.d20srd.org)
