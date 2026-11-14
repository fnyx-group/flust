# AGENTS.md

## Project

flust is a privacy-first mobile app (iOS and Android) to quit pornography and track recovery.
All user data stays on the device, encrypted. No accounts, no ads, no analytics, no third-party trackers.

## Stack

- Expo SDK 58, React Native, TypeScript (strict), Expo Router
- pnpm
- Native modules: Swift (iOS Screen Time), Kotlin (Android VPN filtering)

## Layout

    src/app/        routes only: every file is a screen, `_layout.tsx` defines navigators
    src/features/   screens and hooks: journal, streak, emergency, blocking
    src/domain/     pure logic: streaks, ranks, dates
    src/data/       storage and crypto
    src/ui/         shared components and theme
    src/lib/        shared infrastructure such as i18n
    modules/        native code
    assets/         brand and images
    docs/           architecture, security, decisions, development guides
    docs/product/   vision, features, ranks, relapse, scenarios
    docs/design/    design system and screen mockups

## Commands

    pnpm expo start                   # dev server
    pnpm expo install <pkg>           # add a dependency with the SDK-compatible version
    pnpm expo install --fix           # fix incompatible versions
    pnpm expo install <pkg> -- -D     # add a dev dependency
    pnpm lint                         # lint
    pnpm typecheck                    # typecheck
    pnpm test                         # unit tests
    pnpm format                       # format with Prettier
    pnpm format:check                 # check formatting
    pnpm dlx expo-doctor              # diagnose dependencies and config

Lint, typecheck, tests and format check must pass before any change is considered done.

## Expo

- Expo APIs change between SDK releases. Use the docs matching the installed version:
  https://docs.expo.dev/versions/v58.0.0/ and the index at https://docs.expo.dev/llms.txt
- Always add dependencies with `pnpm expo install`, never plain `pnpm add`.
- `ios/` and `android/` are generated. Never edit them by hand: configure native behavior in `app.json` and config plugins.
- Libraries with native code need a development build, not Expo Go.
- Prefer official Expo modules over third-party libraries.

## Code style

- Layers, lint rules and tooling are described in `docs/development/conventions.md`; follow them.
- Self-explanatory code.
- Comments are written in English, only to explain a non-obvious reason (why, not what). Short, precise, no filler.
- No commented-out code, no banner comments, no emojis.
- Small, focused functions and files.

## Tests

- Test business logic and sensitive code: encryption, storage, streak calculation, dates.
- Test files live next to the code: `foo.ts` -> `foo.test.ts`.
- No snapshot tests, no trivial render tests, no tests of third-party libraries.
- Every fixed bug gets a test that reproduces it.

## Docs

- Documentation is written in English and lives in `docs/`. See `docs/README.md` for the index.
- Folder and file names in English, kebab-case.
- Every significant architecture decision gets a new file in `docs/decisions/` (`NNNN-short-title.md`: context, decision, consequences).
- Product behavior must follow `docs/product/`. Visuals must follow `docs/design/design-system.md`.

## Commits

- Conventional Commits: feat, fix, docs, refactor, test, chore, ci, build, perf, security.
- Imperative mood, English, no emojis. Keep the subject under 72 characters (hard limit: 100).
- One logical change per commit. All commits must be signed.

## Security and privacy

- Never add network calls, telemetry, crash reporters or SDKs that send data off the device.
- Never commit secrets, keys or tokens.
- Sensitive data is encrypted at rest with platform keystores (Keychain / Android Keystore).
- New dependencies must be justified, maintained and minimal.
