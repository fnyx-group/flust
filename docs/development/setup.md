# Development setup

## Environment

Development happens inside a distrobox container, which keeps Node, pnpm and the tooling isolated from the host.

Requirements:

- Node 24 (see `.node-version`).
- pnpm 12 (the exact version is pinned by `packageManager` in `package.json`).
- gitleaks 8.19 or later, installed as a binary (the pre-commit hook runs `gitleaks git --staged`).

## First run

    pnpm install
    pnpm lefthook install
    pnpm expo start

`pnpm lefthook install` sets up the git hooks. It is not run automatically because dependency build scripts are denied (see below).

## Running the app

- Expo Go: enough for JavaScript-only work. Scan the QR code shown by `pnpm expo start`.
- Development build: required as soon as native code is involved (the modules in `modules/`, or any library with native code).

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
