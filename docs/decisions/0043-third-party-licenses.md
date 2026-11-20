# 0043 Third-party licenses

## Context

Most of what flust ships is other people's code: JavaScript packages in the bundle, and Maven modules, Expo and React Native libraries and native code compiled into them in the APK. Their licenses ask for their notices to ship with the app. Until V0.2, lot 4, the Licenses screen covered only the filter's lists ([0039](0039-filter-lists-and-licenses.md)). Google's `oss-licenses` plugin needs Google Play services, which flust does not ship ([0021](0021-local-notifications.md)). `pnpm licenses list --prod` lists about 500 packages, the build tools that `expo` depends on included, while the bundle holds about 60.

## Decision

- The notices come from what the release build really ships, not from the declared dependencies:
  - the npm packages in the source map of the release bundle, with the license that `pnpm licenses list --prod --json` gives and every license or notice file of the package. A bundled package that is not a production dependency fails the build;
  - the Maven modules of the `releaseRuntimeClasspath` of `:app`, with the licenses of their POMs, following parent POMs, read by the Gradle init script `scripts/licenses/report.gradle`. A module published from inside an npm package, as Expo's are, and each library project, are read from that package;
  - the native libraries and notice files of the APK, which `licenses/native.json` maps to what they hold: the module that builds each `.so`, and the code compiled into it without a Gradle module of its own, such as Folly, glog, SQLCipher, OpenSSL, libjpeg-turbo or zstd. A library or a notice file of the APK that the map does not cover fails the build, and so does an entry of the map that the APK does not hold.
- `licenses/overrides.json` gives the text, and when needed the license, of what does not ship a text the build can read: a package without a license file, or a Maven module, whose POM names its license without its copyright line. The texts sit in `licenses/texts/`, copied from their upstream repositories. Apache-2.0 modules without an override get the license text. An override that nothing uses fails the build.
- The allowed licenses are in `scripts/licenses/allowed.ts`: 0BSD, Apache-2.0, BSD-2-Clause, BSD-3-Clause, BSL-1.0, CC0-1.0, ISC, MIT, MPL-2.0, the Unlicense, Zlib, SQLite's blessing, IJG for libjpeg-turbo, OFL-1.1 for the font packages only, and the LLVM exception. A choice passes when one side is allowed; a combination when every part is. GPL, LGPL, AGPL and CC-BY stay out, as for the lists.
- Each dependency must have a text, and a notice license such as MIT, BSD or ISC must have its own copyright line: a template text fails.
- `scripts/update-licenses.sh` writes `src/features/settings/third-party-licenses.json`, which is committed, so a change of dependency shows in review. The file stores each text once, the libraries pointing to it, since most share the Apache or the MIT text.
- `pnpm test` checks the committed file: allowed licenses, texts present, no unused text. The `android-release` job of `native.yml` builds the production APK and runs `scripts/update-licenses.sh --check`, which fails when the file differs from what the build ships. Changes to `licenses/`, `scripts/licenses/` and the file trigger it.
- The Licenses screen shows two groups: the filter's lists, and the libraries of the app, each with its name, version and license, and its text on a tap. It is offered on Android only until lot 3, when the iPhone's native code joins the file.
- No plugin and no new dependency: the report is an init script, the rest runs on Node and `unzip`.

## Consequences

- A dependency update that brings a new library, a new `.so` or a license not allowed fails CI until the file is regenerated, or until the new code is mapped, given a text or removed.
- The file is generated from a production prebuild only. The development variant links the development client, which production leaves out ([0044](0044-production-modules.md)), and would list it.
- The release classpath lists modules that R8 then removes from the APK, such as the masked view. They stay listed: listing too much is harmless, and reading the dex files for each module would not be reliable.
- `licenses/native.json` is kept by hand from what each `.so` holds. The check catches a new library, not new code compiled into a library already mapped. Versions of the code inside Fresco and zstd-kmp are shown as the version of the module that bundles them.
- The texts of `licenses/texts/` are copied once and reviewed like code. A text that changes upstream changes only when someone copies it again.
- About 270 libraries and 180 KB of text ship in the JavaScript bundle.
