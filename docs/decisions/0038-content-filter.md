# 0038 Content filter

## Context

V0.2 adds a filter that blocks pornography and AI-generated pornography across the whole phone ([Content filter](../product/content-filter.md)). flust has no server and promises that no one sees the browsing ([0001](0001-local-first.md), [0006](0006-no-network-access.md)). Android and iOS offer different tools: Android lets an app run a local VPN, iOS offers Screen Time with individual authorization and caps custom domains.

## Decision

- Android: a local `VpnService` that carries DNS only, in the Kotlin module `modules/flust-filter`.
  - The tunnel routes a fake DNS address and the addresses of the major public resolvers, in IPv4 and IPv6. Other traffic never enters it.
  - DNS on port 53, over UDP and TCP, is answered. Other TCP to a routed address is reset at once, other UDP is dropped, so encrypted DNS to a known resolver fails fast and browsers fall back to the system resolver.
  - Each name and its parents are looked up in compiled lists ([0039](0039-filter-lists-and-licenses.md)). A blocked name gets NXDOMAIN. An allowed name goes to Quad9 over DNS over TLS ([0033](0033-android-filter-network-access.md)).
  - The decision follows a fixed order: the strict mode guard, SafeSearch, the user's exceptions, the blocked categories, then the resolver. The strict guard comes first so an exception cannot reopen a bypass.
  - SafeSearch rewrites Google, Bing, DuckDuckGo and YouTube to their restricted names with a CNAME, resolved by the filter.
  - The settings live in their own file in `noBackupFilesDir`, encrypted with AES-GCM under their own Android Keystore key, so the service can start at boot without the database.
  - The service starts again after a reboot when it was on and the VPN consent still holds, and the app resumes it at launch.
- iOS: Screen Time with Apple's automatic adult filter and at most 45 of our domains. Nothing leaves the phone.
- Anything that weakens the filter waits 20 minutes on the continuous clock ([0024](0024-lock-wait.md)), on both platforms.
- In V0.2, lot 1, the engine runs behind a development setting, in the development build only.

## Consequences

- On Android the filter covers every app that uses the system DNS, and flust can see and explain each bypass: strict Private DNS, another VPN, the VPN turned off.
- Lookups pass through flust's code, which must stay small and audited. A crash of the service stops the filter, and flust shows it.
- iOS coverage depends on Apple's filter and on 45 domains, so the two platforms do not block the same things. The website says what each allows.
- Full tunnels, accessibility services, Device Owner and DNS proxy extensions are left aside, for the reasons in the design.
