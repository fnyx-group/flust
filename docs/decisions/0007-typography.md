# 0007 Typography

## Context

The interface needs a readable typeface for text and a distinctive one for the large streak counter. The fonts must be free to bundle and must not be loaded from the network (see [0006 No network access](0006-no-network-access.md)).

## Decision

- Manrope, weights 400 to 800, for the whole interface.
- Barlow Condensed, weights 500 and 600, for numbers only, with tabular figures for counters.

Both fonts are bundled with the app. Sizes and weights are defined in the [design system](../design/design-system.md).

## Consequences

- A condensed face lets the streak counter stay large on small screens.
- Two font families add to the app size, so only the weights listed above are bundled.
- Both fonts are released under the SIL Open Font License, which allows bundling them in the app.
