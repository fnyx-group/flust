# AGENTS.md

## Project

flust is a privacy-first mobile app (iOS and Android) to quit pornography and track recovery.
All user data stays on the device, encrypted. No accounts, no ads, no analytics, no third-party trackers.

## Stack

- Expo SDK 58, React Native, TypeScript (strict), Expo Router
- pnpm
- Native modules: Swift (iOS Screen Time), Kotlin (Android VPN filtering)

## Layout

- src/app/        routes only: every file is a screen, `_layout.tsx` defines navigators
- src/features/   journal, streak, emergency, blocking
- src/lib/        crypto, storage, shared utilities
- src/ui/         shared components
- modules/        native code
- assets/         brand and images
- docs/           architecture and threat model

## Commands

    pnpm expo start            # dev server
    pnpm expo install <pkg>    # add a dependency with the SDK-compatible version
    pnpm expo install --fix    # fix incompatible versions
    pnpm expo lint             # lint
    pnpm tsc --noEmit          # typecheck
    pnpm dlx expo-doctor       # diagnose dependencies and config

Lint and typecheck must pass before any change is considered done.

## Expo

- Expo APIs change between SDK releases. Use the docs matching the installed version:
  https://docs.expo.dev/versions/v58.0.0/ and the index at https://docs.expo.dev/llms.txt
- Always add dependencies with `pnpm expo install`, never plain `pnpm add`.
- `ios/` and `android/` are generated. Never edit them by hand: configure native behavior in `app.json` and config plugins.
- Libraries with native code need a development build, not Expo Go.
- Prefer official Expo modules over third-party libraries.

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
