# 0032 Accessibility pass

## Context

A review before version 0.1 found places where flust fell short of WCAG 2.2 AA or of its own rules ([design system](../design/design-system.md), [scenarios](../product/scenarios.md#devices)):

- The locked color, `#5C5B66`, was used for text: the "???" of locked ranks, the weekday initials before the start, the note placeholders and the days the calendar does not allow. It reaches 2.82:1 on the background and 2.59:1 on the surface, under the 4.5:1 that text needs.
- Calendar days were 40 points, under the 44 point touch target.
- Stack transitions slid even with Reduce Motion on: the system setting does not reach them.
- A disabled button used the pressed opacity, 0.8, so it looked available.
- At a text scale of 2.0, the urge segmented control broke its labels mid-word, wheel rows overflowed their 44 point rows, tab labels clipped in the fixed tab bar, rank names clipped in a third of the screen, the lock screen could push its buttons off screen, the reminder time chip touched its edges, a note title was cut to a word or two, and the breathing phase name could overflow its ring.
- Nothing stopped a new control from shipping without a role, or a field without a label.

## Decision

- A `muted` color, `#8A8994`, for dimmed text: 5.46:1 on the background and 5.02:1 on the surface. `locked` stays for shapes only: emblems, stars, bars and borders, which show a state that the label also gives.
- `src/ui/theme.test.ts` computes the WCAG contrast of every text color on every background it is used on (4.5:1), and of the accent on the background and the surface as a shape (3:1).
- Calendar days are 44 by 44. The calendar card keeps a thin side padding so that seven of them fit a 360 point screen.
- With Reduce Motion on, every stack screen fades in instead of sliding, through `useReduceMotion` in the root layout.
- Disabled controls use `disabledOpacity`, 0.4; pressed ones keep 0.8.
- Above a text scale of 1.3 (`largeTextScale`, read through `useLargeText` in `src/ui`), layouts change instead of clipping: the segmented control stacks its segments, the rank grid goes from 3 columns to 2, a note title in the journal gets up to three lines, and the help and plan rows stack, as they already did. The lock screen scrolls when its content no longer fits, and the reminder time chip has vertical padding.
- A few texts sit in a place of fixed size, so their growth is capped, each by a value of `maxFontScale` in `src/ui/theme.ts` with its reason:

  | Text                        | Cap | Reason                                                          |
  | --------------------------- | --- | --------------------------------------------------------------- |
  | Streak counter              | 1   | Already the largest text, sized to fit one line                 |
  | Breathing phase and seconds | 1   | Inside a 220 point ring whose circle shrinks to 70 percent      |
  | Lapse summary values        | 1.2 | Two 48 point numbers side by side                               |
  | Wheel rows                  | 1.2 | Rows are 44 points high, the interval the wheel snaps to        |
  | Tab labels                  | 1.3 | The tab bar has a fixed height; iOS shows them large on a press |
  | Emergency countdown         | 1.5 | In the header row, next to the close button                     |

  Screen readers read each of them in full. Every other text grows freely.

- ESLint rejects a `Pressable` without `accessibilityRole` (or `role`) and a `TextInput` without `accessibilityLabel` (or `aria-label`). A `Pressable` marked `accessible={false}`, such as a sheet backdrop, is exempt: the sheet has its own Cancel button.
- Hints are kept only where the label does not tell the result, such as a link that opens outside flust or a row that opens a list. The note row's "Opens the note" was removed.

## Consequences

- Dimmed text is a little brighter than before, so locked ranks and days before the start read less faint against unlocked ones; the emblems and stars keep the locked color and carry the difference.
- The calendar card is narrower inside than other cards, by design.
- The capped texts stay readable at a text scale of 2.0 but do not reach it. The decision lists each one, so a new cap needs a reason here and in the theme.
- The lint rules check the attribute is present, not that it is right: a label still needs review, and a device check with TalkBack or VoiceOver remains part of the release ([testing](../development/testing.md)).
- Layout at large text sizes is not covered by tests: it is checked by hand on a device at a text scale of 2.0.
