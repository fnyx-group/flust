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

On the ranks screen and the rank unlock screen, each emblem shows rarity stars. The number of stars equals the circle number, from 1 star in circle I to 5 stars in circle V. The rank badge on the home screen shows the emblem without stars, since it is smaller.

Unlocked emblems use the accent color. Locked emblems use the locked color. See the [design system](../design/design-system.md).

## Locked ranks

Locked ranks show "???" instead of their name, except the next rank to unlock, which shows its name and the number of clean days it requires.

## Unlocking

The rank unlock screen appears when the user reaches a new rank.

When several ranks unlock while the app is closed, the unlock screen shows the highest one and lists the others below it. It is shown once, not once per rank.

The unlock screen appears on the home screen: when it opens, within the minute a rank is reached, and when the app returns to the foreground. It never covers another screen: a rank reached while the emergency screen or another tab is open is announced on returning home. It never appears during the onboarding, but a journey started in the past shows its unlock screen as soon as the home screen first appears.

A rank is stored as unlocked when its unlock screen opens, so the screen is never shown twice for the same rank. If storing fails, the screen is shown again on the next launch.

The unlock screen shows "Nouveau rang", the emblem with its stars, the rank name, the total clean days and one line about the circle: "Le cercle de la Lumière s'ouvre." for the first rank of a circle, "Tu avances dans le cercle de l'Ombre." for the others. "Continuer" returns home, "Voir mes rangs" opens the ranks tab.

## Ranks screen

The ranks tab shows the current rank with its emblem, stars, circle and the days left to the next rank, then the rule in one line, then the twelve ranks in a grid. Before the first clean day, it shows the first rank, locked, and the time left to it, like the home badge.

## After Free soul

This section describes a planned evolution, not implemented yet. It is planned for V0.4 (see [Features](features.md)).

Once Free soul is unlocked, every additional 365 total clean days adds a yearly seal to the rank. The rank then reads "Âme libre · an II" at 730 total clean days, "Âme libre · an III" at 1095, and so on. The year is shown in Roman numerals on screen and spoken as a number by screen readers, such as "Âme libre, an 2".

A yearly seal reuses the Free soul emblem, with a small seal marker next to the rank name. Reaching a new seal shows a lighter version of the rank unlock screen.

There are no new circles or ranks after Free soul. Progress slows down on purpose, to once a year, because the goal is for the person to need the app less over time.

To watch with testers: the gaps between 180, 270 and 365 days. If they feel too long, an intermediate rank around 225 days may be added.
