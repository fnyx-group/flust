# Ranks

Ranks give the user a sense of progress that a lapse cannot take away.

## Rule

The rank depends on total clean days, never on the current streak. A lapse restarts the streak but keeps total clean days, so it never lowers the rank. A rank, once unlocked, stays unlocked.

## Total clean days

Total clean days are computed from the start point and the lapses, never counted with a running timer. The lapses split the journey into segments: from the start to the first lapse, from each lapse to the next, and from the last lapse to now. Each segment counts its whole days, the elapsed time divided by 24 hours and rounded down, and the total is the sum over all segments. Segments are capped at now: a lapse recorded after now, because the clock is behind, ends its segment at now, so time that has not elapsed yet is never counted.

A lapse therefore costs at most the partial day it interrupts. For example, 7.5 days after the start the total is 7. A lapse backdated to day 3.7 splits this into segments of 3.7 and 3.8 days, which count 3 days each, so the total becomes 6. The rank stays Initiate, because an unlocked rank is never lost, and the next rank, Watcher, is 8 days away.

## Circles and ranks

There are twelve ranks, grouped in five circles. The French name is the one shown in the French interface.

| Circle | Circle name (French) | Rank | Rank name (French)           | Total clean days |
| ------ | -------------------- | ---- | ---------------------------- | ---------------- |
| I      | Awakening (Éveil)    | 1    | Novice (Novice)              | 1                |
| I      | Awakening (Éveil)    | 2    | Apprentice (Apprenti)        | 3                |
| I      | Awakening (Éveil)    | 3    | Initiate (Initié)            | 7                |
| II     | Shadow (Ombre)       | 1    | Watcher (Veilleur)           | 14               |
| II     | Shadow (Ombre)       | 2    | Black mage (Mage noir)       | 30               |
| II     | Shadow (Ombre)       | 3    | Sorcerer (Sorcier)           | 45               |
| III    | Light (Lumière)      | 1    | White mage (Mage blanc)      | 60               |
| III    | Light (Lumière)      | 2    | Silver mage (Mage d'argent)  | 90               |
| III    | Light (Lumière)      | 3    | Archmage (Archimage)         | 120              |
| IV     | Crown (Couronne)     | 1    | Sovereign (Souverain)        | 180              |
| IV     | Crown (Couronne)     | 2    | Scarlet mage (Mage écarlate) | 270              |
| V      | Absolute (Absolu)    | 1    | Free soul (Âme libre)        | 365              |

## Emblems

Each rank has an emblem. The outer shape identifies the circle:

| Circle | Outer shape                     |
| ------ | ------------------------------- |
| I      | Circle                          |
| II     | Diamond                         |
| III    | Hexagon                         |
| IV     | Square crossed with a diamond   |
| V      | Sun with a double ring and rays |

The inner design identifies the rank within its circle:

| Rank in circle | Inner design                      |
| -------------- | --------------------------------- |
| 1              | A center dot                      |
| 2              | A center dot and an inner outline |
| 3              | A filled inner shape with spokes  |

On the ranks screen and the rank unlock screen, each emblem shows rarity stars. The number of stars equals the circle number, from 1 star in circle I to 5 stars in circle V. The rank card on the home screen shows the emblem without stars, since it is smaller and already names the circle.

Unlocked emblems use the accent color. Locked emblems use the locked color. See the [design system](../design/design-system.md).

## Locked ranks

Locked ranks show "???" instead of their name, except the next rank to unlock, which shows its name and the number of clean days it requires.

## Unlocking

The rank unlock screen appears when the user reaches a new rank.

When several ranks unlock while the app is closed, the unlock screen shows the highest one and lists the others below it. It is shown once, not once per rank.
