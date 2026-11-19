# 0037 Native builds and supply chain checks in CI

## Context

CI checked the JavaScript and the Kotlin JVM tests only. The production APK was built and checked by hand before a release, the iOS app had never been built, and the Swift code of `modules/flust-privacy` had never compiled. Secrets were scanned only by the pre-commit hook, which can be skipped, and nothing looked at the dependencies a pull request adds.

## Decision

- `.github/workflows/native.yml` builds both apps from the `production` variant on every push to `main`, once a week, and on pull requests that change a native path: the package manifests and lockfile, `app.json`, `app.config.ts`, `eas.json`, `plugins/`, `modules/`, the release checks and the workflow itself.
  - `android-release` runs `assembleRelease` for one ABI, `arm64-v8a`, and `scripts/check-android-release.sh` on the APK. The check reads the manifest and the dex files, which do not depend on the ABI.
  - `ios-build` runs `xcodebuild` for the simulator in Release, without signing, and `scripts/check-ios-release.sh`, which fails on a `CFBundleURLTypes` in the built `Info.plist` ([0035](0035-no-url-scheme-in-production.md)).
  - The builds are skipped by a job condition fed by `native-paths`, not by a path filter on the workflow: a skipped job counts as passed for a required check, while a filtered workflow leaves it pending. `native-paths` is required as well, since the builds are skipped when it fails.
  - They live in their own workflow so that editing a pull request's title, which reruns CI for commitlint, does not rebuild them.
- `ci.yml` adds:
  - `secrets`: gitleaks on the commits of a pull request, and on the full history on `main`. The gitleaks action needs a paid license for organizations, so the release binary is downloaded and checked against a SHA-256 written in the workflow.
  - `shellcheck` on `scripts/*.sh`.
  - `audit`: `pnpm audit --prod --audit-level moderate`. Production dependencies only, since the advisories on development tools are dismissed. An advisory is ignored only in `pnpm-workspace.yaml`, with its reason, and reviewed at each Expo update.
  - `dependency-review` on pull requests, failing on a new dependency with a moderate or worse advisory.
- `codeql.yml` runs CodeQL on the TypeScript and on the workflows, with the `security-extended` queries.
- Every job has a timeout and only the permissions it needs; actions are pinned by commit SHA.

## Consequences

- A change that breaks a production build, or adds a URL scheme, a permission or Google Play services code, fails before it is merged rather than at release time.
- A pull request that changes a native path waits for the builds, the iOS one the longest. Other pull requests do not.
- A native regression caused by a path missing from the list is only caught on `main` or by the weekly run. The list is in `native.yml`.
- `audit` can fail on a day a new advisory is published, without any change in the repository. It is then triaged: an update, or an ignore with its reason.
- Dependabot does not update the gitleaks binary: its version and hash are changed together by hand.
- The Maestro flows, reproducible builds and an SBOM are not in CI yet.
