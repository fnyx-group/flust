# flust

flust is a mobile app for iOS and Android that helps people quit pornography, including AI generated pornography. It counts clean days, helps you get through urges with an emergency screen, responds to a lapse without wiping the progress, and keeps a daily check-in and a journal. See [Vision](docs/product/vision.md) and [Features](docs/product/features.md).

## Privacy

Everything flust records stays on the phone. The data lives in a database encrypted with SQLCipher, whose key is held by the Keychain on iOS and the Android Keystore on Android. There is no account, no ads, no analytics and no tracking, and nothing you record is ever sent anywhere. See the [threat model](docs/security/threat-model.md).

Version 0.1 makes no network call at all, and its Android release builds do not request the `INTERNET` permission, which [`scripts/check-android-release.sh`](scripts/check-android-release.sh) checks on an APK or a bundle. This describes the current version, not a permanent promise: the content filter planned for version 0.2 forwards DNS lookups on Android and will need that permission, under the rules of [0033](docs/decisions/0033-android-filter-network-access.md).

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
