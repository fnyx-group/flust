# 0033 Network access of the Android filter

Status: accepted. The details are to be planned in V0.2.

## Context

The content filter of V0.2 runs on Android as a local `VpnService` that filters DNS ([Features](../product/features.md#content-filter)). A DNS filter answers blocked lookups itself, but it must forward allowed lookups to a resolver, or nothing would load. That forwarding is network access: the app opens sockets, which Android refuses without the `INTERNET` permission.

V0.1 makes no network calls and blocks `INTERNET` in production Android builds ([0006](0006-no-network-access.md), [0030](0030-production-android-permissions.md)). The filter cannot work under that rule, so where the network code lives and how it is contained has to be decided before the filter is built.

## Decision

- The filter lives inside flust. From V0.2, the production Android build requests `INTERNET`, for the filter only.
- Network code lives only in the filter's Kotlin module. The lint rules and the source scan of [0030](0030-production-android-permissions.md) stay in force everywhere else, and the scan allows network APIs in that module alone.
- The filter opens sockets only to the DNS resolver. A test checks it.
- The VPN service never touches the database or its key.
- No DNS query is logged, not even in memory.
- The allowlist of `scripts/check-android-release.sh` gains `INTERNET` only in the version that ships the filter. Every other blocked permission stays blocked.
- An independent security audit of the filter takes place before the public release.

### Rejected

- A separate companion app holding the filter. It means two installs for people who are already fragile, two releases to keep in step, and a channel between the two apps that is itself something to secure.
- Android Private DNS alone, pointed at a filtering resolver. The resolver is a third party that sees every lookup, there is no delay before the filter can be turned off, and flust cannot apply its own lists.

## Open points for V0.2

- Which Google Play `VpnService` declaration category fits a filter that people set on themselves.
- Bypass through the encrypted DNS of browsers, which does not go through the system resolver.

## Consequences

- From V0.2, the Android build can open sockets, and the guarantee of V0.1 that the app cannot reach the network on Android no longer holds. The containment rests on the module boundary, the tests and the audit instead.
- The DNS resolver sees the allowed lookups, as it would without flust. Its choice is planned with the filter.
- iOS is not affected: the Screen Time APIs filter without flust forwarding anything.
