# flust

flust is a mobile app for iOS and Android that helps people quit pornography, including AI generated pornography. It counts clean days, helps you get through urges with an emergency screen, responds to a lapse without wiping the progress, and keeps a daily check-in and a journal. See [Vision](docs/product/vision.md) and [Features](docs/product/features.md).

## Privacy

Everything flust records stays on the phone. The data lives in a database encrypted with SQLCipher, whose key is held by the Keychain on iOS and the Android Keystore on Android. There is no account, no ads, no analytics and no tracking, and nothing you record is ever sent anywhere. See the [threat model](docs/security/threat-model.md).

flust makes no network call of its own. From version 0.2, its content filter on Android forwards the DNS lookups it allows, encrypted, to the Quad9 resolver, and nothing else: no query is logged, and blocked lookups never leave the phone. The Android build requests `INTERNET` for the filter only, under the rules of [0033](docs/decisions/0033-android-filter-network-access.md) and [0041](docs/decisions/0041-filter-network-permissions.md), which [`scripts/check-android-release.sh`](scripts/check-android-release.sh) checks on an APK or a bundle. Version 0.1 made no network call at all and did not request that permission.

## Status

Version 0.1 is complete. flust is still in development and is not in the App Store or Google Play yet.

## Roadmap

- 0.2: a content filter for pornographic sites and AI generators.
- 0.3: an encrypted video journal.
- 0.4: statistics, a discreet mode, encrypted backup and export, and a full list of help resources.
- 1.0: release on the App Store and Google Play.

Details by version are in [Features](docs/product/features.md).

## Build and test

flust is an Expo app written in TypeScript, built with pnpm. Setup, development builds, tests and releases are described in [docs/development](docs/development/setup.md). The full documentation index is in [docs](docs/README.md).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

flust is licensed under the [Mozilla Public License 2.0](LICENSE).

## Website

[fnyx-group.org/flust](https://fnyx-group.org/flust/)
