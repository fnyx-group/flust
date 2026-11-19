# 0033 Network access of the Android filter

Status: accepted. The resolver and its transport were settled in V0.2, lot 1; `INTERNET` reaches the production build in lot 2.

## Context

The content filter of V0.2 runs on Android as a local `VpnService` that filters DNS ([Content filter](../product/content-filter.md), [0038](0038-content-filter.md)). A DNS filter answers blocked lookups itself, but it must forward allowed lookups to a resolver, or nothing would load. That forwarding is network access: the app opens sockets, which Android refuses without the `INTERNET` permission.

V0.1 makes no network calls and blocks `INTERNET` in production Android builds ([0006](0006-no-network-access.md), [0030](0030-production-android-permissions.md)). The filter cannot work under that rule, so where the network code lives and how it is contained has to be decided before the filter is built.

## Decision

- The filter lives inside flust. From V0.2, the production Android build requests `INTERNET`, for the filter only.
- Network code lives only in the filter's Kotlin module, `modules/flust-filter`. The lint rules and the source scan of [0030](0030-production-android-permissions.md) stay in force everywhere else. The scan allows network APIs in that module alone, each file only for its part, and its tests.
- The filter opens sockets only to the DNS resolver, from one file, `ResolverTransport.kt`, to an endpoint built only in `Quad9.kt`. The source scan checks both.
- The resolver is Quad9, reached over DNS over TLS (RFC 7858) on port 853, at its hard-coded IPv4 and IPv6 addresses. The module never looks up its name. Its sockets are marked with `protect()`, so they leave the tunnel even though the tunnel routes Quad9's addresses for every other app.
- TLS validates the certificate for `dns.quad9.net`, against the certificates that ship with Android only. A certificate authority added by the person or a device policy is not trusted. The TLS code is part of the audit scope.
- Strict mode blocks `dns.quad9.net` with the other DoH and DoT provider names, for every app. flust's own lookups are not affected, since they go by address.
- There is no fallback to plain DNS. Some networks block port 853, and lookups fail there. A DNS over HTTPS fallback can be added later if the tests on real networks show it is needed.
- The VPN service never touches the database or its key. Its settings are encrypted under a key of their own.
- No DNS query is logged, not even in memory: the filter keeps no cache, and a name is held only while it is answered.
- The allowlist of `scripts/check-android-release.sh` gains `INTERNET` only in the version that ships the filter. Every other blocked permission stays blocked. Until then the VPN service is declared in the development build only, and the release check fails on a build that has the service without `INTERNET`, `INTERNET` without the service, or any other VPN service.
- Detecting strict Private DNS, which sends lookups around the filter, needs `ACCESS_NETWORK_STATE` in the production build. It is blocked today ([0030](0030-production-android-permissions.md)) and is decided in lot 2.
- An independent security audit of the filter takes place before the public release.

### Rejected

- A separate companion app holding the filter. It means two installs for people who are already fragile, two releases to keep in step, and a channel between the two apps that is itself something to secure.
- Android Private DNS alone, pointed at a filtering resolver. The resolver is a third party that sees every lookup, there is no delay before the filter can be turned off, and flust cannot apply its own lists.
- DNS over HTTPS as the transport. It needs an HTTP client in the module, more code to audit than the 2-byte framing of DNS over TLS.
- Plain DNS to the resolver. The network would see every allowed lookup.

## Open points for V0.2

- Which Google Play `VpnService` declaration category fits a filter that people set on themselves, decided in lot 2.

## Consequences

- From V0.2, the Android build can open sockets, and the guarantee of V0.1 that the app cannot reach the network on Android no longer holds. The containment rests on the module boundary, the source scan, the release check, the tests and the audit instead.
- Quad9 sees the allowed lookups, as a resolver would without flust, and not the blocked ones. It also blocks known malware domains, which the app states.
- Where port 853 is blocked, the filter stops resolving and flust says so, rather than sending lookups in clear.
- iOS is not affected: the Screen Time APIs filter without flust forwarding anything.
