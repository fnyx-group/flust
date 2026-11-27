# 0032 Accessibility pass

## Context

A review before version 0.1 found places where flust fell short of WCAG 2.2 AA or of its own rules ([design system](../design/design-system.md), [scenarios](../product/scenarios.md#devices)):

- The locked color, `#5C5B66`, was used for text: the "???" of locked ranks, the weekday initials before the start, the note placeholders and the days the calendar does not allow. It reaches 2.82:1 on the background and 2.59:1 on the surface, under the 4.5:1 that text needs. It also drew the ring of an unchecked radio button, under the 3:1 a control's outline needs.
- The wheel rows next to the selected one faded to 3.24:1, the outer rows to 1.49:1, and today's bar in the week strip, the accent at 50 percent, reached 2.08:1.
- Calendar days were 40 points, under the 44 point touch target.
- Stack transitions slid even with Reduce Motion on: the system setting does not reach them.
- A disabled button, the lapse undo button and the stepper buttons used the pressed opacity or the locked color, so a disabled button looked available.
- At a text scale of 2.0, the urge segmented control broke its labels mid-word, wheel rows overflowed their 44 point rows, tab labels clipped in the fixed tab bar, rank names clipped in a third of the screen, the lock screen could push its buttons off screen, the reminder time chip touched its edges, a note title was cut to a word or two, and the breathing phase name could overflow its ring.
- Nothing stopped a new control from shipping without a role, or a field without a label.

## Decision

- A `muted` color, `#8A8994`, for dimmed text: 5.46:1 on the background and 5.02:1 on the surface. `locked` stays for the locked emblems and stars, which show a state that the label also gives; ESLint allows it only in `rank-emblem.tsx` and `rank-stars.tsx`. The ring of an unchecked radio button, which shows that a row can be chosen, uses `muted`.
- The wheel shows the selected row in the text color, the rows next to it in secondary text at 0.7 opacity (4.9:1) and the outer rows in solid `muted`. Today's bar in the week strip is the accent at 0.71 opacity (3:1).
- `src/ui/theme.test.ts` computes the WCAG contrast of each listed text pair (4.5:1), including the faded wheel rows, and of each listed shape (3:1): the accent, the radio ring and today's bar. A new pair, or a color drawn at an opacity, needs a line there.
- Calendar days are 44 by 44. The calendar card keeps a thin side padding so that seven of them fit a 360 point screen.
- With Reduce Motion on, every stack screen fades in instead of sliding, through `useReduceMotion` in the root layout. While the setting is still unknown, screens fade, as the breathing guide and the wheels stay still. The note editor follows the cursor to the end of the text without animation.
- Disabled controls use `disabledOpacity`, 0.4, even when touched; pressed ones keep 0.8. `controlOpacity` in `src/ui` gives both, and its test reproduces the bug.
- Above a text scale of 1.3 (`largeTextScale`, read through `useLargeText` in `src/ui`), layouts change instead of clipping: the segmented control stacks its segments, the rank grid goes from 3 columns to 2, a note title in the journal gets up to three lines, and the help and plan rows stack, as they already did. The lock screen scrolls when its content no longer fits, and the reminder time chip has vertical padding.
- A few texts sit in a place of fixed size, so their growth is capped, each by a value of `maxFontScale` in `src/ui/theme.ts` with its reason:

  | Text                 | Cap | Reason                                                                                 |
  | -------------------- | --- | -------------------------------------------------------------------------------------- |
  | Streak counter       | 1   | Already the largest text, sized to fit one line                                        |
  | Breathing seconds    | 1   | A 56 point number inside a 220 point ring whose circle shrinks to 70 percent           |
  | Lapse summary values | 1.2 | Two 48 point numbers side by side                                                      |
  | Wheel rows           | 1.2 | Rows are 44 points high, the interval the wheel snaps to                               |
  | Tab labels           | 1.3 | The tab bar has a fixed height; iOS shows them large on a press                        |
  | Breathing phase      | 1.5 | A word or two in the same ring: it may cross the circle's edge, but not leave the ring |
  | Emergency countdown  | 1.5 | In the header row, next to the close button                                            |

  Screen readers read each of them in full. Every other text grows freely.

- ESLint rejects a `Pressable` without `accessibilityRole` (or `role`) and a `TextInput` without `accessibilityLabel` (or `aria-label`), also written as `RN.Pressable` or `RN.TextInput`. A `Pressable` hidden from screen readers on both platforms, with `importantForAccessibility="no"` and `accessibilityElementsHidden`, such as a sheet backdrop, is exempt: the sheet has its own Cancel button. `accessible={false}` alone is not enough, since TalkBack still reaches a touchable view. So that nothing escapes the rule, ESLint also rejects the `Touchable` components, a pressable `Text`, an animated `Pressable` or `TextInput`, and either one under another name.
- Hints are kept only where the label does not tell the result, such as a link that opens outside flust or a row that opens a list. The note row's "Opens the note" and the low mood card's "Opens help numbers", on "Help numbers", were removed.
- `useLargeText` lives in `src/ui`, so that shared components can use it, while `useReduceMotion` stays in `src/features/shared`: `src/ui` components that move, such as the wheel, take Reduce Motion as a prop. Moving it is left for later.

## Consequences

- Dimmed text is a little brighter than before, so locked ranks and days before the start read less faint against unlocked ones; the emblems and stars keep the locked color and carry the difference.
- The calendar card is narrower inside than other cards, by design.
- The capped texts stay readable at a text scale of 2.0 but do not reach it. The decision lists each one, so a new cap needs a reason here and in the theme.
- The lint rules check the attribute is present, not that it is right: `accessibilityRole={undefined}` passes, and so does a role passed on from props, such as the navigator's in `TabBarButton`. A label still needs review, and a device check with TalkBack or VoiceOver remains part of the release ([testing](../development/testing.md)).
- A wrapper that spreads its props onto a `Pressable` must still set the role itself.
- Layout at large text sizes is not covered by tests: it is checked by hand on a device at text scales of 1.3, the largest that keeps the usual layouts, and 2.0.
