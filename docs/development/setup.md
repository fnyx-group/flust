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

## End-to-end tests

The Maestro flows run locally against the production release APK, on an emulator ([0031](../decisions/0031-end-to-end-tests.md)). They need the [Android build tools](#android-build-tools) above, Maestro and an emulator.

1. Maestro needs Java 17 or later. The JBR of Android Studio, already in `JAVA_HOME`, is newer and works: check with `"$JAVA_HOME"/bin/java -version`.
2. Turn off Maestro's analytics, update check and test analysis notice in the container shell profile, before Maestro runs for the first time. Any `maestro` command, even `maestro --version`, saves the analytics choice on its first run, and saves it as on without the variable. `scripts/e2e-android.sh` sets the same variables, and the profile also covers Maestro run by hand:

       echo 'export MAESTRO_CLI_NO_ANALYTICS=1' >> ~/.bashrc
       echo 'export MAESTRO_DISABLE_UPDATE_CHECK=true' >> ~/.bashrc
       echo 'export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true' >> ~/.bashrc

3. Install Maestro from its GitHub release, checked against the SHA-256 published with it, never through its `curl | bash` installer. The version is pinned: the environment variables above were checked against this version's source. The commands are chained, so nothing is unpacked after a failed check:

       mkdir -p ~/tools/downloads &&
         curl -fL -o ~/tools/downloads/maestro-2.12.1.zip https://github.com/mobile-dev-inc/maestro/releases/download/cli-2.12.1/maestro.zip &&
         echo "54dbb0716425626604973cbb374c585ca30272375d9ce15177a1152765ddd9d7  $HOME/tools/downloads/maestro-2.12.1.zip" | sha256sum -c &&
         mkdir ~/tools/maestro-2.12.1 &&
         unzip -q ~/tools/downloads/maestro-2.12.1.zip -d ~/tools/maestro-2.12.1 &&
         echo 'export PATH="$HOME/tools/maestro-2.12.1/maestro/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"' >> ~/.bashrc

   The same SHA-256 is in the release's `checksums_sha256.txt` and next to `maestro.zip` on the release page. A mismatch means the file is not the one published: delete it. For a newer version, take its SHA-256 from its release page, and check the variable names above and in `scripts/e2e-android.sh` against its source before switching.

4. Block the servers Maestro reports to. Its crash reporter has no setting to turn it off, and the hosts below also serve its analytics and update check, already off through the variables above. In the 2.12.1 source:

   | Host                     | Used for                                                                                                        |
   | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
   | `api.copilot.mobile.dev` | Crash reports (`/maestro/error`), the update check (`/v2/maestro/version`), and Maestro's cloud and AI features |
   | `us.i.posthog.com`       | Analytics (PostHog)                                                                                             |

   The changelog shown after an update check comes from `raw.githubusercontent.com`, which other tools need. It is only fetched once the update check has succeeded, so blocking `api.copilot.mobile.dev` stops it too.

   The container's `/etc/hosts` is the host's file, mounted read-only, so the entries are added on the host and apply to it too. Run the command in a terminal on the host, outside the distrobox: through `distrobox-host-exec`, `sudo` gets no terminal to ask for the password. The `::` entries cover IPv6, since `us.i.posthog.com` has IPv6 addresses:

       sudo tee -a /etc/hosts <<'EOF'
       # Maestro crash reports, analytics and update check
       0.0.0.0 api.copilot.mobile.dev
       0.0.0.0 us.i.posthog.com
       :: api.copilot.mobile.dev
       :: us.i.posthog.com
       EOF

   Check from the container that both names now resolve to `0.0.0.0` and `::` only:

       getent ahosts api.copilot.mobile.dev us.i.posthog.com

   For a newer version of Maestro, search its source for `https://` again before switching.

5. Open a new shell, check `maestro --version`, then check that the analytics choice was saved as off. Maestro keeps it in `~/.local/state/maestro/` (`$XDG_STATE_HOME/maestro/`), not in `~/.maestro`:

       grep '"enabled" : false' ~/.local/state/maestro/analytics.json

   If it shows nothing, delete `analytics.json` and run `maestro --version` again in a shell that has the variables.

   Maestro writes the logs of each run to `~/.local/state/maestro/tests/`: the commands with the text typed, the emulator PIN included, and the screen hierarchies. Nothing there comes from a real phone, and the folder can be deleted at any time.

6. Use the existing emulator, `Medium_Phone_API_37.0` (API 37, Google Play image, 1080 by 2400). Start it from the Device Manager of Android Studio on the host; `adb` in the container reaches it, since the container shares the host's network. To start it from the container instead, point the emulator at the host's virtual devices:

       ANDROID_AVD_HOME=/home/<user>/.android/avd emulator -avd Medium_Phone_API_37.0

   The emulator's system language must be English: the flows tap system dialogs and settle on screens that follow the device language. No fingerprint may be enrolled, so that the system prompt asks for the PIN.

   The lock flow needs a screen lock PIN. With no screen lock, the script sets one (1357) and removes it at the end. With a screen lock already set, `E2E_PIN` must hold its PIN, such as `E2E_PIN=1234 scripts/e2e-android.sh`: the script then uses it and leaves it in place, and stops if the PIN does not match. Its Google Play image includes TalkBack, for the [manual checks](manual-checklist.md).

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
