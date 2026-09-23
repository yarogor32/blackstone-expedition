# Critical hits, morale and expedition dialogue

## Reference choices
- Darkest Dungeon: separate critical chance; critical damage is 150% of maximum skill damage; critical hits interact with stress. https://darkestdungeon.wiki.gg/wiki/Critical_Hit_(Darkest_Dungeon)
- D&D 2024: natural 20 on the attack roll is a critical hit, with extra damage dice. https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game
- This implementation uses the first damage model. The morale/breakdown formula below is original project balance, not a claim about either reference game.

## Resolution order
1. Evade / accuracy check. A miss does no damage, no morale loss, no crit check.
2. Independent crit check AFTER a successful hit. Shot 8%, aimed shot 12%, blade 5%, enemies 5%. These are conditional on hitting.
3. Normal damage: integer roll in the skill range. Crit: ceil(maximum skill damage * 1.5).
4. Apply outgoing/incoming condition multipliers, round, minimum 1. Subtract HP.
5. Player target loses max(2, ceil(actual HP lost / maximum HP * 30)) morale, plus 10 for a crit. Clamp morale to 0..maxMorale.
6. A surviving player hit by a crit checks breakdown probability:
   clamp(10% + 50% * missing-morale-fraction + 25% * missing-HP-fraction - stressResistance, 5%, 80%). Uses morale AFTER that hit's morale loss.
7. Breakdown loses another 15 morale and adds one random condition if none already exists. Conditions do not stack. Subsequent breakdowns still animate and lose morale.
8. A hero's successful crit restores 3 of their own morale. Enemy morale is not simulated.

Example: a fresh Ranger takes 6 critical damage at 28 maximum HP: morale falls to 83, breakdown chance is about 23.9%.
A breakdown plays Got Hit followed by all 37 stress frames at 12 fps, then restarts Idle. Lethal damage retains the death reaction and never triggers stress animation.
Shot sound, damage, CRIT/MISS and dialogue resolve at the existing 1.3-second impact.

## Persistent conditions
| State | Modifier |
|---|---|
| Panicky | −10 accuracy, −2 speed |
| Paranoid | −8 accuracy, −5 critical chance |
| Despair | ×0.8 damage |
| Tremor | −15 accuracy |
| Exhaustion | −3 speed, ×0.9 damage |
| Rage | −12 accuracy, ×1.15 incoming damage |

Rest eligibility is defined by character, not affliction. Ranger: Yacht only; Space Marine: Shrine/Yacht; Drukhari: Tavern/Yacht; humans: all three; Kroot: Tavern/Yacht; Mechanicus: Shrine/Yacht. Future heroes may override with restPlaces. Only owned, implemented crew appear in the picker.

Rest costs 250 Thrones at assignment and completes upon return of the next expedition, including retreat or defeat. It restores maximum morale and clears afflictions. Resting heroes are excluded from departure; an empty party cannot depart. Cancelling before departure refunds payment without recovery. Building levels unlock 1–3 portrait slots. Assignments and building upgrades persist in the inventory save.


## Content and assets
- morale.js: tuning constants, condition definitions, probability formula.
- locales/expedition-en.js: 5 categories, 3 lines per category for Ranger, Rogue Trader, Kroot, Mechanicus, Space Marine and Drukhari; human/default fallback. English source for later translations.
- expedition-speech.js: no immediate repeated line in the same hero/category; 4-second text barks. Neutral at battle entry and every 30 seconds of exploration; positive on hit/evasion; negative on miss/damage; extreme variants on outgoing/incoming critical hits. Dead heroes do not speak.
- sprites/ranger-stress.png: existing Ranger_Stress import, original normalized sheet preserved.
- branding/miss.png and branding/crit.png: generated with built-in image_gen. Prompt: single compact text-only hand-painted gothic serif wordmark, exactly MISS / CRIT, deep ink shadows; MISS bone ivory, CRIT antique gold with restrained red; transparent background; no frame, skulls, plaque or scene; legible at 110px width.

Checks: deterministic model tests for both-side crits/misses, losses, breakdown, modifiers, lethal handling, persistence; browser checks for PNG labels, stress animation timing and paid treatment.
