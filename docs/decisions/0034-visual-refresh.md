# 0034 Visual refresh

## Context

The screen boards in `docs/design/screens` were redrawn. They keep the dark theme and the violet accent, but they add color where the first version had almost none:

- Each circle of ranks has its own color, used by its emblems, its header on the ranks screen and the circle named on the home screen.
- Section labels, icon tiles in the settings and selected chips take a color that tells what the section is about: calm and protection, moments and reminders, the user's own reasons.
- Destructive actions are red: the "Tout effacer" row and screen, deleting a note, removing a reason or a plan, clearing the error report. Emergency numbers are red too.

The design system said the accent was the only color besides greys, and that flust used no red. Red near a lapse, the streak or the ranks would read as failure, which the [relapse model](0004-relapse-model.md) avoids. The new boards needed rules that keep that promise while allowing the new colors.

The boards also drop the separators of the first version: no "·", no guillemets, no dashes, and no colon inside a sentence. French times read "21 h" rather than "21:00".

## Decision

- New color tokens in `src/ui/theme.ts`:
  - `teal` `#4FD1C5`: calm and protection (privacy lines, the lock, breathing, plans, listening lines) and circle I.
  - `gold` `#F2B84B`: moments and reminders (risk moments, the evening check-in, urges) and circle III.
  - `coral` `#FF7A7A`: circle IV.
  - `danger` `#FF7A7A`: destructive actions and emergency numbers only.
  - `accentText` `#A99EFF`: violet text and labels. The accent itself reaches 4.44:1 on the surface, under 4.5:1.
  - `accentSurface` `#1F1C33`: cards that hold the user's own progress or plan.
  - `lockedFill` `#22222B`: the fill of a locked emblem and the track of the streak ring.
- Each circle has its color, in `circleColors`: teal, violet, gold, coral, then white for circle V. Text takes `circleTextColors`, the same except `accentText` for circle II. Emblems are filled in that color and lose their stars, since the color and the shape name the circle.
- The violet accent stays the color of primary buttons, progress and clean days.
- Red is only for destructive actions and emergency numbers. It is never used on the lapse screens, the counter, the week strip or the ranks, even though circle IV and danger share a value: circle IV is a rank color, not a warning, and the lint rule and the docs keep the two names apart.
- A tinted fill, a color at a fixed opacity over the surface, marks icon tiles (0.16), selected chips (0.22), danger cards (0.12) and their borders (0.5). `tint()` builds it from a token.
- Every pair in use is checked in `src/ui/theme.test.ts`: each new text color on the background, the surface and `accentSurface` (all above 6.5:1, `accentText` 7.09:1 at least), text on each tint, and the on-accent color on teal, gold and danger (7.46:1 at least). Circle colors are checked as shapes at 3:1.
- Text never uses a separator sign or a colon to join parts of a sentence. A test checks every string of both languages. French times on a 24 hour clock are written "21 h" or "21 h 14", with no-break spaces, through `formatClockTime`; other languages and 12 hour clocks keep the platform's format.
- The emergency countdown shows whole minutes, rounded up, such as "19 min".

## Consequences

- The design system documents which color goes with which meaning. A new screen picks from those meanings instead of choosing a color for looks.
- A destructive button or confirmation is red, so it stands out from the plain "Annuler" next to it. Sheets that only discard a draft, such as leaving a note unsaved, stay neutral.
- `colors.locked` now also draws control borders and the off switch track, so ESLint allows it in `button.tsx` and `switch-row.tsx` as well as `rank-emblem.tsx`. The rarity stars and their component are gone.
- Labels that joined parts with a colon, such as "Série en cours : 12 jours" for screen readers, now use a comma. The French typography test still checks the no-break space before "?", "!" and ";".
- The countdown no longer changes every second, so it draws less attention while the breathing guide runs.
