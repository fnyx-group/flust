# Development setup

## Environment

Development happens inside a distrobox container, which keeps Node, pnpm and the tooling isolated from the host.

Requirements:

- Node 24 (see `.node-version`).
- pnpm 12 (the exact version is pinned by `packageManager` in `package.json`).
- gitleaks 8.19 or later, installed as a binary (the pre-commit hook runs `gitleaks git --staged`).
- `EXPO_NO_TELEMETRY=1` exported in the container shell profile, so the Expo and EAS CLIs send no usage data:

      echo 'export EXPO_NO_TELEMETRY=1' >> ~/.bashrc

## First run

    pnpm install
    pnpm lefthook install
    pnpm expo start

`pnpm lefthook install` sets up the git hooks. It is not run automatically because dependency build scripts are denied (see below).

## Running the app

- Expo Go: enough for JavaScript-only work. Scan the QR code shown by `pnpm expo start`.
- Development build: required as soon as native code is involved (the modules in `modules/`, or any library with native code).

## Development build

Builds run on EAS, with the profiles in `eas.json`:

| Profile       | `APP_VARIANT` | Name        | Identifier                | Distribution |
| ------------- | ------------- | ----------- | ------------------------- | ------------ |
| `development` | `development` | `flust dev` | `org.fnyxgroup.flust.dev` | internal     |
| `preview`     | `production`  | `flust`     | `org.fnyxgroup.flust`     | internal     |
| `production`  | `production`  | `flust`     | `org.fnyxgroup.flust`     | store        |

`app.config.ts` reads `APP_VARIANT` on top of `app.json`. The development build has its own identifier, so it installs next to the store app. Without `APP_VARIANT`, the config is production.

The development build targets real devices, not simulators. It only needs to be rebuilt when native code or native dependencies change.

1. Register the phone (iOS only, once per device): `pnpm dlx eas-cli device:create`.
2. Build: `pnpm dlx eas-cli build --profile development --platform ios` (or `android`).
3. Install the build on the phone from the link or QR code EAS prints at the end.
4. Start the dev server for the development variant:

       pnpm dev

5. Open `flust dev` on the phone and pick the server, or scan the QR code with the camera. Do not use Expo Go: it lacks the native code of the dev build.

## Dependencies

- Add dependencies with `pnpm expo install <pkg>`, dev dependencies with `pnpm expo install <pkg> -- -D`.
- Dependency build scripts are denied. `pnpm-workspace.yaml` lists each package that ships one, under `allowBuilds`. A new entry set to `true` needs a reason.
- `pnpm dlx expo-doctor` diagnoses version and config problems.

## Checks

    pnpm typecheck
    pnpm test:coverage
    pnpm lint
    pnpm knip
    pnpm format:check

The same checks run in CI on every pull request and on pushes to `main`.
