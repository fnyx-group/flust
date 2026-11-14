# 0006 No network access

## Context

[0001 Local-first](0001-local-first.md) forbids network calls carrying user data. Any network access remains a risk: a request can reveal that the app is installed, carry metadata, or be added later by a dependency. Remote crash reporting and over-the-air updates are common in Expo apps and both need the network.

## Decision

flust makes no network calls at all.

- No remote crash reporting. Errors go to a local log without personal data, which the user can export and send manually.
- No over-the-air updates. Every update, including hotfixes, goes through a new store release.
- Blocklists for the content filter are bundled with the app.
- An automated test fails on any network request.

## Consequences

- The app works fully offline and cannot leak data over the network.
- Crashes are known only when users report them. Error boundaries, safe mode and local logs must make reports useful.
- Fixes take as long as a store review. Phased rollouts limit the impact of a bad release.
- Blocklists are updated only with app updates.
- Every new dependency must be checked for network activity.
