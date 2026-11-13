# 0002 Expo and pnpm

## Context

flust targets iOS and Android from one codebase, and needs native code for content blocking (Screen Time on iOS, VPN filtering on Android).

## Decision

- Expo (SDK 58) with React Native, TypeScript in strict mode and Expo Router.
- Native features are written as local Expo modules in Swift and Kotlin, configured through `app.json` and config plugins. `ios/` and `android/` are generated, never edited.
- pnpm as package manager, pinned with the `packageManager` field. Dependencies are added with `pnpm expo install` so their versions match the SDK.

## Consequences

- One TypeScript codebase for both platforms, with native code only where required.
- Upgrades follow the Expo SDK cycle, and `pnpm expo install --fix` keeps versions aligned.
- Native modules require a development build, Expo Go is limited to JavaScript-only work.
- pnpm denies dependency build scripts unless they are explicitly allowed in `pnpm-workspace.yaml`.
