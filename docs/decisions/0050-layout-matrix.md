# 0050 Layout at every text and display size

## Context

A field test on a Xiaomi Poco F4 showed that with a large font size or display size the bottom of the home screen and of the journal was cut, and that the language row of the settings split its label and value into two narrow columns at the largest font. The first run of the check below found the same squeeze on other settings rows from a font scale of 1.0 at the largest display size, where "Verrouillage" broke over three lines beside its value. Android offers font scales from 0.85 to 2.0 and display sizes from one step below the default density to up to three above it, and they combine. Checking each screen at each combination by hand is not possible, and screenshots are black under the screen privacy flag ([0025](0025-screen-privacy.md)), so a check has to read the view hierarchy.

Home pins the check-in line, the urge button and the lapse link under its scrolling content ([design system](../design/design-system.md#home)). At large sizes that block took close to half the height, which left little room for the rest.

## Decision

- Home keeps its rule at the default text and display size: no scroll from 667 points tall. Beyond it, nothing is cut and "J'ai une envie" always stays on screen without scrolling. When the pinned block, without the undo line, takes more than 35 % of the window height, the check-in line, the lapse link and the undo line move into the scrolling content, under the notices, and only the urge button stays pinned. Their heights do not depend on where they are laid out, so the choice cannot flip back and forth. `pinsAllActions` in `src/features/home/home-fit.ts` makes it.
- A navigation row puts its value at the end of the label's line, and under the label when both do not fit on it, at any text and display size. Its label never breaks inside a word because of the value.
- The welcome screen scrolls when it does not fit, and its language pill wraps under the name.
- `scripts/e2e-android.sh --layout` runs the flows of `e2e/maestro/layout/` in order, one per screen in French, whose texts are longer, each from the screen the previous one left. After each, `maestro hierarchy` dumps the screen, and `scripts/check-layout.ts` fails when:
  - two texts or controls overlap, by more than a dp each way;
  - a text or control outside a view that scrolls reaches the tab bar, the navigation bar, the status bar or a side of the screen;
  - a view that scrolls runs under the tab bar, the navigation bar or the status bar;
  - a text outside a view that scrolls is squashed below 8 dp;
  - inside one control, a single word is half as tall again as the text beside it, so it broke over lines;
  - at a font scale of 1.0 or less and a default display, a swipe moves home.
- The display sizes are those Android offers on the emulator, computed from its density and width as Settings computes them. `--matrix` runs the layout flows at the corners: font scale 0.85 at the smallest display size, 1.0 at the default, 1.3 at the largest, and 2.0 at the smallest and the largest. `--full-matrix` runs them at every font scale and display size, 35 combinations on the emulator, before a release. Both end with the home check on a 750 by 1334 pixel screen at 320 dpi, 667 dp tall. A full run of the script ends with two passes: font scale 1.0 at the default density, and 2.0 at the largest. The last layout flow logs a lapse, so every pass also checks home with its undo line.
- The dump is Maestro's, not `uiautomator dump`, which waits for an idle screen that the emergency screen's breathing guide never gives.

## Consequences

- A layout change is checked at the corners in about 30 minutes, at the two extremes on every full run, and at all 35 combinations in more than four hours before a release.
- The check sees only what is in the hierarchy, with bounds already clipped: a text cut inside its own frame, such as by a line limit, and a control pushed entirely off screen are not seen. The flows assert the controls that must show, and the rest stays in the [manual checklist](../development/manual-checklist.md).
- React Native's ScrollView reports itself scrollable even when its content fits, so whether home scrolls is checked by a swipe rather than read from the hierarchy.
- At large sizes, the check-in line and the lapse link can need a scroll on home. The urge button never does.
