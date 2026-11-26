# 0041 Network permissions of the filter in production

## Context

From V0.2, lot 2, the production Android build ships the content filter ([0038](0038-content-filter.md)). Its VPN service forwards allowed lookups to Quad9 and needs `INTERNET`, as planned in [0033](0033-android-filter-network-access.md). Showing why the filter is inactive also needs to read the phone's networks: strict Private DNS sends lookups around the tunnel, and another VPN app takes its place. `ConnectivityManager.getAllNetworks`, `getNetworkCapabilities` and `getLinkProperties` require `ACCESS_NETWORK_STATE`, which [0030](0030-production-android-permissions.md) blocks in production because V0.1 never used it.

## Decision

- `INTERNET` and `ACCESS_NETWORK_STATE` leave `PRODUCTION_BLOCKED_PERMISSIONS` for `PRODUCTION_ANDROID_PERMISSIONS` in `app.config.ts`, and the same lists in `scripts/check-android-release.sh`, which a test compares. `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SYSTEM_EXEMPTED` joined them later, for the VPN service in the foreground ([0047](0047-filter-foreground-service.md)): normal permissions, granted at install without a prompt.
- `plugins/with-android-filter.ts` declares both, with the VPN service and the boot receiver, in every variant. Neither depends on a library's manifest.
- `ACCESS_NETWORK_STATE` is read in `NetworkState.kt` of the filter module only, which turns the networks into two answers: strict Private DNS, and another VPN while flust's tunnel is down. Nothing about the networks is stored or leaves the app. Without the permission, or on a failure, it reports no network rather than a wrong reason.
- The release check fails on a build without the filter's VPN service, without one of the two permissions, or with any other VPN service. A production build without the filter is no longer a valid release.
- Every other permission blocked by [0030](0030-production-android-permissions.md) stays blocked.

## Consequences

- The production app can open sockets, and so can its dependencies: `expo-file-system` and React Native could reach the network without flust asking. The containment now rests on the module boundary, the source scan, the lint rules, the release check, review of dependencies and the audit of [0033](0033-android-filter-network-access.md).
- `ACCESS_NETWORK_STATE` is a normal permission, granted at install without a prompt, and shown in the store listing.
- The store listing and the website must say that flust uses the network for the filter only ([Google Play VpnService declaration](../release/google-play-vpn-declaration.md)).
