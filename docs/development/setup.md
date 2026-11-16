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

## Android build tools

Only needed to build Android locally and to run the release check ([Release](release.md)); EAS builds without them. The container has its own home folder, but the host's home stays reachable at its usual path, so it uses the Android SDK and the JDK that Android Studio installed on the host.

1. In Android Studio on the host, install the SDK, then in the SDK Manager, under SDK Tools, the Android SDK Command-line Tools.
2. Export the JDK bundled with Android Studio (JBR) and the SDK in the container shell profile, with the paths of the host:

       echo 'export JAVA_HOME=/home/<user>/<android-studio>/jbr' >> ~/.bashrc
       echo 'export ANDROID_HOME=/home/<user>/Android/Sdk' >> ~/.bashrc

   Gradle reads the SDK from `ANDROID_HOME`, since the generated project has no `local.properties`.

3. Accept the SDK licenses once, so that Gradle can download the NDK and CMake it needs:

       "$ANDROID_HOME"/cmdline-tools/latest/bin/sdkmanager --licenses

4. The release check reads a bundle with bundletool. Download its jar from the [GitHub releases](https://github.com/google/bundletool/releases), check it against the SHA-256 that GitHub shows next to the file on the release page, and export its path:

       mkdir -p ~/tools
       curl -fL -o ~/tools/bundletool-all-1.18.3.jar https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar
       echo "a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29  $HOME/tools/bundletool-all-1.18.3.jar" | sha256sum -c
       echo 'export BUNDLETOOL="$HOME/tools/bundletool-all-1.18.3.jar"' >> ~/.bashrc

   For a newer version, take the SHA-256 from its release page. A mismatch means the file is not the one Google published: delete it.

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
