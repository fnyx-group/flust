# AGENTS.md

## Project

flust is a privacy-first mobile app (iOS and Android) to quit pornography and track recovery.
All user data stays on the device, encrypted. No accounts, no ads, no analytics, no third-party trackers.

## Stack

- Expo / React Native, TypeScript (strict)
- pnpm
- Native modules: Swift (iOS Screen Time), Kotlin (Android VPN filtering)

## Layout

- app/        screens and navigation
- src/        features, storage, crypto, ui
- modules/    native code
- assets/     brand and images
- docs/       architecture and threat model

## Code style

- Self-explanatory code. Comment only to explain a non-obvious reason, never to restate the code.
- No commented-out code, no banner comments, no emojis.
- Small, focused functions and files.

## Commits

- Conventional Commits: feat, fix, docs, refactor, test, chore, ci, build, perf, security.
- Imperative mood, English, subject under 72 characters, no emojis.
- One logical change per commit. All commits must be signed.

## Security and privacy

- Never add network calls, telemetry, crash reporters or SDKs that send data off the device.
- Never commit secrets, keys or tokens.
- Sensitive data is encrypted at rest with platform keystores (Keychain / Android Keystore).
- New dependencies must be justified, maintained and minimal.
