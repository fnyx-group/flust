# Documentation

## Product

- [Vision](product/vision.md): purpose, principles and non-goals.
- [Features](product/features.md): features by version.
- [Ranks](product/ranks.md): circles, ranks, emblems and unlock rules.
- [Relapse](product/relapse.md): how the app responds to a lapse.
- [Scenarios](product/scenarios.md): edge cases and expected behavior.
- [Quotes](product/quotes.md): the daily quotes, their order and their sources.
- [Content filter](product/content-filter.md): the V0.2 filter on Android and iPhone, its lists, limits, delivery and test plan.

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
- [0016 Lapse records and urge events](decisions/0016-lapse-records-and-urge-events.md): lapses stored and undone by id, with their details and plan change; each emergency visit recorded.
- [0017 Emergency elapsed clock](decisions/0017-emergency-elapsed-clock.md): the countdown and the breathing follow a monotonic elapsed time, not the wall clock.
- [0018 Daily check-in](decisions/0018-daily-check-in.md): one check-in per stored local day, editable until midnight, and the low mood rule.
- [0019 Journal notes](decisions/0019-journal-notes.md): notes keep their stored local day and UTC offset, grouped by week and month, an excerpt-only list.
- [0020 Editable reasons and plans](decisions/0020-editable-reasons-and-plans.md): rows edited by id, limits and at least one plan, an undo that only restores the row the lapse wrote.
- [0021 Local notifications](decisions/0021-local-notifications.md): expo-notifications on iOS without push, a local Kotlin module on Android, no Firebase.
- [0022 Reminder schedule](decisions/0022-reminder-schedule.md): a week planned ahead, spacing that thins out, a cap per day, one return message, then silence.
- [0023 App lock](decisions/0023-app-lock.md): device authentication as a UI gate, a cover in the background, held links, a pause without a screen lock.
- [0024 Lock wait](decisions/0024-lock-wait.md): a growing wait between attempts, on a clock that counts sleep and ignores the date, resumed after a restart.
- [0025 Screen privacy](decisions/0025-screen-privacy.md): screenshots and app switcher previews blocked in production, allowed in development.
- [0026 Android splash symbol](decisions/0026-android-splash-symbol.md): the symbol alone, sized for the Android 12 splash mask.
- [0027 Offline help resources](decisions/0027-offline-help-resources.md): a bundled list by device region, official sources checked every year, calls through the phone app.
- [0028 Error boundaries and safe mode](decisions/0028-error-boundaries-and-safe-mode.md): a boundary per route and at the root, a launch counter, safe mode outside the lock.
- [0029 Local error log](decisions/0029-local-error-log.md): no messages, 50 entries, AES-GCM with its own key, shown in full before the share sheet.
- [0030 Production Android permissions](decisions/0030-production-android-permissions.md): network and storage permissions blocked in production only, checked in the source and in the release build.
- [0031 End-to-end tests](decisions/0031-end-to-end-tests.md): Maestro flows on the production release APK, on a local emulator before each release, not in CI.
- [0032 Accessibility pass](decisions/0032-accessibility-pass.md): a muted color for dimmed text, contrast tests, 44 point calendar days, fades with Reduce Motion, layouts that change with large text and documented caps.
- [0033 Network access of the Android filter](decisions/0033-android-filter-network-access.md): from V0.2, `INTERNET` for the DNS filter only, network code in its module alone, Quad9 over DNS over TLS, no query logged, an audit before release.
- [0034 Visual refresh](decisions/0034-visual-refresh.md): a color per circle and per meaning, red only for destructive actions and emergency numbers, no separators in text, French times as "21 h".
- [0035 No URL scheme in production](decisions/0035-no-url-scheme-in-production.md): no scheme or URL type in production builds, a release check that fails on one, incoming links sent home or ignored.
- [0036 Keyboard learning](decisions/0036-keyboard-learning.md): Android text fields ask the keyboard not to learn their content; iOS has no such API.
- [0037 Native builds and supply chain checks in CI](decisions/0037-ci-native-builds.md): production Android and iOS builds checked in CI when native paths change, secret scanning, dependency audit and review, CodeQL.
- [0038 Content filter](decisions/0038-content-filter.md): a DNS-only local VPN on Android, Screen Time on iOS, two controls only, a fixed decision order, strict mode and SafeSearch, a 20 minute delay to weaken it.
- [0039 Filter lists and licenses](decisions/0039-filter-lists-and-licenses.md): MIT, Unlicense and CC0 sources with their provenance, excluded lists checked, hashed lists compiled at build.
- [0040 Filter delay](decisions/0040-filter-delay.md): 20 minutes to weaken the filter, then a confirmation that expires after 10, on the elapsed clock and the boot count.
- [0041 Network permissions of the filter in production](decisions/0041-filter-network-permissions.md): `INTERNET` and `ACCESS_NETWORK_STATE` for the filter only, a release check that requires the filter.
- [0042 Filter onboarding step and disclosure](decisions/0042-filter-onboarding-and-disclosure.md): an Android-only step before the start point, Google Play's disclosure before every VPN consent.
- [0043 Third-party licenses](decisions/0043-third-party-licenses.md): notices generated from what the release build ships, committed, with an allowlist checked in CI.
- [0044 Development modules out of production](decisions/0044-production-modules.md): the development client and the DOM web view are not linked into production builds.

## Development

- [Setup](development/setup.md): local environment, first run and development builds.
- [Conventions](development/conventions.md): code style, layers, lint rules, commits, branches, pull requests.
- [Testing](development/testing.md): what to test, where, and how.
- [Release](development/release.md): the checks before each store release, and a local production build.
- [Manual checklist](development/manual-checklist.md): the device checks before each release that tests cannot cover.

## Release

- [Google Play VpnService declaration](release/google-play-vpn-declaration.md): the proposed category, the disclosure, the Data safety answers and the scripts of the two videos.
