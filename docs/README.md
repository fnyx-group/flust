# Documentation

## Product

- [Vision](product/vision.md): purpose, principles and non-goals.
- [Features](product/features.md): features by version.
- [Ranks](product/ranks.md): circles, ranks, emblems and unlock rules.
- [Relapse](product/relapse.md): how the app responds to a lapse.
- [Scenarios](product/scenarios.md): edge cases and expected behavior.
- [Quotes](product/quotes.md): the daily quotes, their order and their sources.

## Design

- [Design system](design/design-system.md): colors, typography, layout, navigation and screens.

## Architecture

- [Overview](architecture/overview.md): routing, source layout, native modules, local storage.

## Security

- [Threat model](security/threat-model.md): sensitive data, threats and mitigations.

## Decisions

- [0001 Local-first](decisions/0001-local-first.md): all user data stays on the device, encrypted.
- [0002 Expo and pnpm](decisions/0002-expo-pnpm.md): framework and package manager.
- [0003 MPL-2.0 license](decisions/0003-mpl-2-0-license.md): file-level copyleft license.
- [0004 Relapse model](decisions/0004-relapse-model.md): a streak that restarts, total clean days that are kept.
- [0005 Rank system](decisions/0005-rank-system.md): ranks based on total clean days.
- [0006 No network access](decisions/0006-no-network-access.md): no network calls, no remote crash reporting.
- [0007 Typography](decisions/0007-typography.md): Manrope and Barlow Condensed.
- [0008 Internationalization](decisions/0008-internationalization.md): French and English, all strings externalized.
- [0009 Source layers](decisions/0009-source-layers.md): domain, data, features, ui and app, enforced by lint.
- [0010 Domain errors as results](decisions/0010-domain-errors-as-results.md): expected failures are returned, not thrown.
- [0011 Encrypted SQLite storage](decisions/0011-encrypted-sqlite-storage.md): SQLCipher, a device-only key, startup outcomes and migration backups.
- [0012 Onboarding flow](decisions/0012-onboarding-flow.md): a journey decides the first screen, a resumable draft, answers saved in one transaction.
- [0013 Local time to UTC](decisions/0013-local-time-to-utc.md): one tested conversion, with a fixed rule for daylight saving changes.
- [0014 Minute clock](decisions/0014-minute-clock.md): time-driven screens recompute from timestamps on a shared tick aligned to the streak.
- [0015 Rank unlock announcement](decisions/0015-rank-unlock-announcement.md): unlocks are checked on Home's clock and stored when their screen opens, so each rank is announced once.

## Development

- [Setup](development/setup.md): local environment, first run and development builds.
- [Conventions](development/conventions.md): code style, layers, lint rules, commits, branches, pull requests.
- [Testing](development/testing.md): what to test, where, and how.
