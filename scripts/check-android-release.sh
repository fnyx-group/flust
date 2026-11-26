#!/usr/bin/env bash
# Fails when an Android build contains Firebase, Google Play services or Play Install Referrer
# code, or their manifest entries (docs/decisions/0021-local-notifications.md), or when its merged
# manifest requests a permission that is blocked in production or not expected
# (docs/decisions/0030-production-android-permissions.md), or when a component has an intent filter
# that opens a URL scheme (docs/decisions/0035-no-url-scheme-in-production.md), or when it declares
# a VPN service other than the content filter's, or lacks the filter's service or one of the
# permissions it needs (docs/decisions/0041-filter-network-permissions.md), or runs that service
# without the systemExempted foreground type or lacks its restart job bound with BIND_JOB_SERVICE
# (docs/decisions/0047-filter-foreground-service.md), or when it holds classes
# of the development modules that production leaves out (docs/decisions/0044-production-modules.md).
# It also fails on what Google Play refuses: another package than the production one, a debuggable
# build, a target API level below Play's, a version that is not the one of app.json, and 64-bit
# native libraries not aligned for 16 KB pages (docs/decisions/0046-android-bundle-and-upload-key.md).
# Lists the merged permissions.
#
# 32-bit native libraries not aligned for 16 KB pages are listed, without failing.
#
# A bundle is also checked for its 16 KB alignment setting, the native libraries of the four ABIs,
# its R8 mapping and native symbols, and its signer, which is printed: the template's debug key,
# or with --upload the upload key. Its universal APK is then built and goes through every APK
# check, and the notices of the Licenses screen are checked against it.
#
# An APK is read with aapt2, from $AAPT2, the PATH or $ANDROID_HOME/build-tools, its alignment
# checked with zipalign, from $ZIPALIGN or the newest build-tools of $ANDROID_HOME, 35 or later, and
# its native libraries with llvm-readelf, from $LLVM_READELF, the PATH or the NDKs of $ANDROID_HOME.
# A bundle is read with the bundletool jar at $BUNDLETOOL, the release pinned in
# scripts/bundletool.sh, run by the Java of $JAVA_HOME or the PATH, and its licenses checked by
# $UPDATE_LICENSES, scripts/update-licenses.sh by default, from the production prebuild in android/.
# Exits with 1 when the build contains something flust must not ship, 2 when it cannot be checked.
# Usage: scripts/check-android-release.sh [--upload] <app.apk|app.aab>
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repository=$(dirname "$script_dir")

production_package=org.fnyxgroup.flust

# Google Play has required new apps and updates to target API 36 since 31 August 2026:
# https://developer.android.com/google/play/requirements/target-sdk. Raise it with Play's next
# requirement.
min_target_sdk=36
# The greatest versionCode Google Play accepts.
max_version_code=2100000000

# PLACEHOLDER: the SHA-256 of the upload certificate, set once the upload key exists, as
# docs/development/release.md#upload-key describes. Until then, --upload fails on every bundle.
upload_certificate_sha256=''
min_upload_key_bits=2048
# The certificate of android/app/debug.keystore, which the Expo template ships. A bundle checked
# without --upload must be signed with it, so that a local build signed with anything else stands out.
debug_certificate_sha256=FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C

# zipalign checks 16 KB alignment with -P 16 from build-tools 35.
min_build_tools=35

# Must match PRODUCTION_BLOCKED_PERMISSIONS in app.config.ts, which app.config.test.ts checks.
blocked_permissions=(
  android.permission.SYSTEM_ALERT_WINDOW
  android.permission.WRITE_EXTERNAL_STORAGE
  android.permission.CHANGE_WIFI_MULTICAST_STATE
  android.permission.ACCESS_LOCAL_NETWORK
)

# Must match PRODUCTION_ANDROID_PERMISSIONS in app.config.ts, which app.config.test.ts checks.
expected_permissions=(
  android.permission.INTERNET
  android.permission.ACCESS_NETWORK_STATE
  android.permission.FOREGROUND_SERVICE
  android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED
  android.permission.POST_NOTIFICATIONS
  android.permission.RECEIVE_BOOT_COMPLETED
  android.permission.USE_BIOMETRIC
  android.permission.VIBRATE
  org.fnyxgroup.flust.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
)

# The content filter's VPN service, declared by plugins/with-android-filter.ts, and the
# permissions it needs and that are there for it alone: INTERNET to reach the resolver,
# ACCESS_NETWORK_STATE to see strict Private DNS and another VPN, and the two foreground service
# permissions that keep the VPN service in the foreground.
filter_service=org.fnyxgroup.flust.filter.FilterVpnService
# The service runs in the foreground with the systemExempted type, the one the Play Console
# declaration names, and its restart job can only be bound by the system's JobScheduler
# (docs/decisions/0047-filter-foreground-service.md). aapt2 and bundletool print the type as a flag
# value; the name is accepted too.
filter_service_type=systemExempted
filter_service_type_flag=0x00000400
filter_restart_job=org.fnyxgroup.flust.filter.FilterRestartJob
filter_restart_job_permission=android.permission.BIND_JOB_SERVICE

# The Java packages of the modules that plugins/with-production-modules.ts leaves out of
# production: the development client, its launcher and menu, the modules only they use, and the
# DOM components' web view. expo-dev-menu-interface has no Android code.
development_packages='expo/modules/(devclient|devlauncher|devmenu|manifests|jsonutils|updatesinterface|webview)'
filter_permissions=(
  android.permission.INTERNET
  android.permission.ACCESS_NETWORK_STATE
  android.permission.FOREGROUND_SERVICE
  android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED
)

# What the Android Gradle plugin puts in a bundle for Play: the native libraries of every ABI that
# Play delivers to, the R8 mapping, and the symbol tables of the native libraries that the release
# build type asks for.
bundle_abis=(armeabi-v7a arm64-v8a x86 x86_64)
bundle_mapping=BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map
bundle_symbols=BUNDLE-METADATA/com.android.tools.build.debugsymbols/

cannot_check() {
  echo "$1" >&2
  exit 2
}

usage="Usage: $0 [--upload] <app.apk|app.aab>"
upload=0
if [[ ${1:-} == --upload ]]; then
  upload=1
  shift
fi
if [[ $# -ne 1 || ! -f $1 ]]; then
  cannot_check "$usage"
fi
build=$1

case $build in
  *.apk)
    [[ $upload -eq 0 ]] || cannot_check "--upload checks a bundle: $build is an APK."
    dex_pattern='^classes[0-9]*\.dex$'
    manifest='AndroidManifest.xml'
    ;;
  *.aab)
    dex_pattern='^[^/]+/dex/classes[0-9]*\.dex$'
    manifest='base/manifest/AndroidManifest.xml'
    ;;
  *)
    cannot_check "Expected an .apk or an .aab: $build"
    ;;
esac

newest_in_sdk() {
  local sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
  [[ -n $sdk ]] && compgen -G "$sdk/$1" | sort -V | tail -n 1
}

find_tool() {
  local variable=$1 name=$2 sdk_glob=$3
  if [[ -n ${!variable:-} ]]; then
    echo "${!variable}"
  elif command -v "$name" >/dev/null; then
    command -v "$name"
  else
    newest_in_sdk "$sdk_glob"
  fi
}

# The SDK's own zipalign, never one from the PATH, whose version is unknown.
find_zipalign() {
  if [[ -n ${ZIPALIGN:-} ]]; then
    echo "$ZIPALIGN"
    return
  fi
  local candidate version
  candidate=$(newest_in_sdk 'build-tools/*/zipalign') || return 0
  version=$(basename "$(dirname "$candidate")")
  [[ ${version%%.*} =~ ^[0-9]+$ && ${version%%.*} -ge $min_build_tools ]] && echo "$candidate"
}

find_java() {
  if [[ -n ${JAVA_HOME:-} ]]; then
    echo "$JAVA_HOME/bin/java"
  else
    command -v java
  fi
}

# Looked up before the scans, so that a missing tool stops the check before it reports anything.
if [[ $build == *.apk ]]; then
  aapt2=$(find_tool AAPT2 aapt2 'build-tools/*/aapt2' || true)
  [[ -n $aapt2 && -x $aapt2 ]] || cannot_check "aapt2 not found: set AAPT2, or ANDROID_HOME to the Android SDK."
  zipalign=$(find_zipalign || true)
  [[ -n $zipalign && -x $zipalign ]] ||
    cannot_check "zipalign of build-tools $min_build_tools or later not found: install them in the SDK of ANDROID_HOME, or set ZIPALIGN."
  readelf=$(find_tool LLVM_READELF llvm-readelf 'ndk/*/toolchains/llvm/prebuilt/*/bin/llvm-readelf' || true)
  [[ -n $readelf && -x $readelf ]] || cannot_check "llvm-readelf not found: set LLVM_READELF, or ANDROID_HOME to an Android SDK with an NDK."
else
  java=$(find_java || true)
  [[ -n $java && -x $java ]] || cannot_check "java not found: set JAVA_HOME."
  keytool=$(dirname "$java")/keytool
  [[ -x $keytool ]] || cannot_check "keytool not found next to $java."
  # CI runs shellcheck on each script alone, which does not follow it.
  # shellcheck disable=SC1091
  source "$script_dir/bundletool.sh"
  problem=$(bundletool_problem) || cannot_check "$problem"
  update_licenses=${UPDATE_LICENSES:-$script_dir/update-licenses.sh}
  [[ -x $update_licenses ]] || cannot_check "Cannot run $update_licenses"
fi
command -v node >/dev/null || cannot_check "node not found: it reads the version of app.json."

mapfile -t dex_files < <(unzip -Z1 "$build" | grep -E "$dex_pattern" || true)
if [[ ${#dex_files[@]} -eq 0 ]]; then
  cannot_check "No dex files found in $build"
fi
# Not grep -q: it stops at the first match, unzip then fails on the closed pipe, and pipefail
# would report the manifest as missing.
if ! unzip -Z1 "$build" | grep -xF "$manifest" >/dev/null; then
  cannot_check "No manifest found in $build"
fi

# grep exits with 1 when nothing matches, which is what a clean build gives. Any other failure in
# the pipeline, such as unzip on a damaged file, still fails it.
matches() {
  grep "$@" || [[ $? -eq 1 ]]
}

indent() {
  local prefix=$1 line
  while IFS= read -r line; do
    printf '%s%s\n' "$prefix" "$line"
  done
}

# A certificate fingerprint without its colons, in upper case.
normalized() {
  tr -d ':' <<<"$1" | tr '[:lower:]' '[:upper:]'
}

bundletool() {
  "$java" -jar "$BUNDLETOOL" "$@"
}

manifest_xpath() {
  bundletool dump manifest --bundle="$build" --xpath="$1"
}

# Class names are plain text in dex files. The manifest is binary XML, with UTF-16 or UTF-8
# strings, or protobuf in a bundle: without the NUL bytes, its names read as text either way.
dex_classes() {
  for dex in "${dex_files[@]}"; do unzip -p "$build" "$dex" || exit 2; done |
    LC_ALL=C matches -a -o -E "L($1)/[A-Za-z0-9_/\$]*" |
    sort -u
}
classes=$(dex_classes 'com/google/firebase|com/google/android/gms|com/android/installreferrer') ||
  cannot_check "Cannot read the dex files of $build"
development_classes=$(dex_classes "$development_packages") || cannot_check "Cannot read the dex files of $build"
entries=$(
  unzip -p "$build" "$manifest" | tr -d '\000' |
    LC_ALL=C matches -a -o -E 'com\.google\.(firebase|android\.gms|android\.c2dm|android\.finsky)[A-Za-z0-9_.]*' |
    sort -u
) || cannot_check "Cannot read the manifest of $build"

# Requested permissions only: a text search would also find android:permission attributes, which
# protect a component, and miss the permissions flust defines.
requested_permissions() {
  if [[ $build == *.apk ]]; then
    "$aapt2" dump permissions "$build" | sed -nE "s/^uses-permission(-sdk-23)?: name='([^']+)'.*/\2/p"
  else
    manifest_xpath '/manifest/uses-permission/@android:name | /manifest/uses-permission-sdk-23/@android:name'
  fi
}

permissions=$(requested_permissions | sort -u) || cannot_check "Cannot read the permissions of $build"
# Every production build requests some, so an empty list means the output was not understood.
[[ -n $permissions ]] || cannot_check "No permission read from $build: check the output of the tool that reads it."
echo "Permissions in $build:"
indent '  ' <<<"$permissions"

# Schemes of the intent filters that open URLs, parsed by url-schemes.awk for an APK.
url_schemes() {
  if [[ $build == *.apk ]]; then
    "$aapt2" dump xmltree --file AndroidManifest.xml "$build" | awk -f "$script_dir/url-schemes.awk"
  else
    manifest_xpath "//intent-filter[action/@android:name='android.intent.action.VIEW']/data/@android:scheme"
  fi
}

schemes=$(url_schemes | sort -u) || cannot_check "Cannot read the intent filters of $build"

# Services that can act as a VPN, parsed by vpn-services.awk for an APK. In both, a permission or
# an action given as a resource reference counts as a VPN, so that the check fails rather than
# miss one.
vpn_services() {
  if [[ $build == *.apk ]]; then
    "$aapt2" dump xmltree --file AndroidManifest.xml "$build" | awk -f "$script_dir/vpn-services.awk"
  else
    manifest_xpath "//service[@android:permission='android.permission.BIND_VPN_SERVICE' or starts-with(@android:permission, '@') or intent-filter/action[@android:name='android.net.VpnService' or starts-with(@android:name, '@')]]/@android:name"
  fi
}

services=$(vpn_services | sort -u) || cannot_check "Cannot read the services of $build"
foreign_services=$(matches -v -x -F "$filter_service" <<<"$services")
has_filter=0
grep -q -x -F "$filter_service" <<<"$services" && has_filter=1
missing_filter_permissions=()
for permission in "${filter_permissions[@]}"; do
  grep -q -x -F "$permission" <<<"$permissions" || missing_filter_permissions+=("$permission")
done

# The value of an attribute of a service, parsed by service-attribute.awk for an APK. Empty when
# the service or the attribute is missing.
service_attribute() {
  if [[ $build == *.apk ]]; then
    "$aapt2" dump xmltree --file AndroidManifest.xml "$build" |
      awk -v service="$1" -v attribute="$2" -f "$script_dir/service-attribute.awk"
  else
    manifest_xpath "//service[@android:name='$1']/@android:$2"
  fi
}

filter_type=$(service_attribute "$filter_service" foregroundServiceType) ||
  cannot_check "Cannot read the services of $build"
job_permission=$(service_attribute "$filter_restart_job" permission) ||
  cannot_check "Cannot read the services of $build"

# One "key=value" line each for the package, the version, the target API level and whether the
# build is debuggable, read from the manifest.
manifest_identity() {
  if [[ $build == *.apk ]]; then
    "$aapt2" dump badging "$build" | awk '
      /^package: / {
        if (match($0, / name='\''[^'\'']*'\''/)) print "package=" substr($0, RSTART + 7, RLENGTH - 8)
        if (match($0, / versionCode='\''[^'\'']*'\''/)) print "versionCode=" substr($0, RSTART + 14, RLENGTH - 15)
        if (match($0, / versionName='\''[^'\'']*'\''/)) print "versionName=" substr($0, RSTART + 14, RLENGTH - 15)
      }
      /^targetSdkVersion:/ { gsub(/'\''/, "", $0); sub(/^targetSdkVersion:/, "", $0); print "targetSdk=" $0 }
      $0 == "application-debuggable" { print "debuggable=true" }
    '
  else
    echo "package=$(manifest_xpath '/manifest/@package')"
    echo "versionCode=$(manifest_xpath '/manifest/@android:versionCode')"
    echo "versionName=$(manifest_xpath '/manifest/@android:versionName')"
    echo "targetSdk=$(manifest_xpath '/manifest/uses-sdk/@android:targetSdkVersion')"
    echo "debuggable=$(manifest_xpath '/manifest/application/@android:debuggable')"
  fi
}

identity=$(manifest_identity) || cannot_check "Cannot read the package and version of $build"
identity_value() {
  sed -n "s/^$1=//p" <<<"$identity" | head -n 1
}
package=$(identity_value package)
version_code=$(identity_value versionCode)
version_name=$(identity_value versionName)
target_sdk=$(identity_value targetSdk)
debuggable=$(identity_value debuggable)
[[ -n $package ]] || cannot_check "No package read from $build: check the output of the tool that reads it."

# The version is set by hand in app.json for each release (docs/development/release.md). One
# "key=value" line each, since an empty value must not shift the other.
app_version=$(node -e '
  const app = require(process.argv[1]).expo;
  console.log("name=" + (app.version ?? ""));
  console.log("code=" + (app.android?.versionCode ?? ""));
' "$repository/app.json") || cannot_check "Cannot read the version of app.json"
expected_version_name=$(sed -n 's/^name=//p' <<<"$app_version")
expected_version_code=$(sed -n 's/^code=//p' <<<"$app_version")

identity_problems=()
[[ $package == "$production_package" ]] ||
  identity_problems+=("package $package, not the production $production_package")
[[ $debuggable != true ]] || identity_problems+=("debuggable")
if [[ ! $target_sdk =~ ^[0-9]+$ || $target_sdk -lt $min_target_sdk ]]; then
  identity_problems+=("targets API level ${target_sdk:-none}, below the $min_target_sdk Google Play requires")
fi
if [[ ! $expected_version_code =~ ^[1-9][0-9]{0,9}$ || $expected_version_code -gt $max_version_code ]]; then
  identity_problems+=("app.json sets no valid expo.android.versionCode, a whole number from 1 to $max_version_code: ${expected_version_code:-none}")
elif [[ $version_code != "$expected_version_code" ]]; then
  identity_problems+=("versionCode ${version_code:-none}, not the $expected_version_code of app.json")
fi
if [[ -z $expected_version_name ]]; then
  identity_problems+=("app.json sets no expo.version")
elif [[ $version_name != "$expected_version_name" ]]; then
  identity_problems+=("versionName ${version_name:-none}, not the $expected_version_name of app.json")
fi
echo "$build: $package, version $version_name ($version_code), target API level $target_sdk."

work=$(mktemp -d "${TMPDIR:-/tmp}/flust-release-check.XXXXXX")
trap 'rm -rf "$work"' EXIT

# A LOAD segment aligned on less than 16 KB cannot be mapped on a device with 16 KB pages. These
# devices are 64-bit only, and Google Play checks the arm64-v8a and x86_64 libraries: the 32-bit
# ones, built for 4 KB pages like the prebuilt React Native and NDK libraries, are never loaded
# there, so they are listed without failing. zipalign checks that the uncompressed libraries start
# on a 16 KB boundary in the APK, which lets the system map them in place.
unaligned_libraries=()
unaligned_32bit_libraries=()
zip_misaligned=''
if [[ $build == *.apk ]]; then
  mapfile -t libraries < <(unzip -Z1 "$build" | grep -E '^lib/(armeabi-v7a|arm64-v8a|x86|x86_64)/[^/]+\.so$' || true)
  for library in "${libraries[@]}"; do
    unzip -p "$build" "$library" >"$work/library.so" || cannot_check "Cannot read $library in $build"
    alignments=$("$readelf" --program-headers --wide "$work/library.so" | awk '$1 == "LOAD" { print $NF }') ||
      cannot_check "Cannot read the program headers of $library in $build"
    [[ -n $alignments ]] || cannot_check "No LOAD segment read from $library in $build"
    while IFS= read -r alignment; do
      if [[ ! $alignment =~ ^0x[0-9a-fA-F]+$ ]] || ((alignment < 0x4000)); then
        case $library in
          lib/arm64-v8a/* | lib/x86_64/*) unaligned_libraries+=("$library (LOAD aligned on $alignment)") ;;
          *) unaligned_32bit_libraries+=("$library (LOAD aligned on $alignment)") ;;
        esac
        break
      fi
    done <<<"$alignments"
  done
  if ! "$zipalign" -c -P 16 4 "$build" >/dev/null 2>&1; then
    # Run again to name the entries: it exits with 1 again, which is expected here. A zipalign that
    # names none failed on something else, such as an option it does not know.
    zip_misaligned=$({ "$zipalign" -c -P 16 -v 4 "$build" 2>&1 || true; } | matches -E 'BAD|FAILED')
    [[ -n $zip_misaligned ]] || cannot_check "$zipalign failed on $build without naming a misaligned entry."
  fi
fi
if [[ ${#unaligned_32bit_libraries[@]} -gt 0 ]]; then
  echo "32-bit native libraries not aligned for 16 KB pages, which devices with 16 KB pages never load (not a failure):"
  printf '  %s\n' "${unaligned_32bit_libraries[@]}"
fi

# A bundle declares the alignment the APKs Play generates from it get, holds the native libraries
# of each ABI Play delivers to, carries the mapping and symbols Play reads crash reports with, and
# its signer tells an upload build from a local one.
bundle_problems=()
if [[ $build == *.aab ]]; then
  config=$(bundletool dump config --bundle="$build") || cannot_check "Cannot read the configuration of $build"
  # The setting itself, not the name anywhere in the configuration: compressed libraries are
  # extracted on install and the alignment then does not apply.
  page_alignment=$(node -e '
    const libraries = JSON.parse(require("fs").readFileSync(0, "utf8")).optimizations?.uncompressNativeLibraries;
    console.log(libraries?.enabled === true ? (libraries.alignment ?? "") : "compressed");
  ' <<<"$config") || cannot_check "Cannot parse the configuration of $build"
  [[ $page_alignment == PAGE_ALIGNMENT_16K ]] ||
    bundle_problems+=("its configuration does not store native libraries uncompressed and aligned on 16 KB pages (uncompressNativeLibraries: ${page_alignment:-no alignment}, not PAGE_ALIGNMENT_16K)")

  files=$(unzip -Z1 "$build") || cannot_check "Cannot list the files of $build"
  for abi in "${bundle_abis[@]}"; do
    grep -q -E "^base/lib/$abi/[^/]+\.so$" <<<"$files" || bundle_problems+=("it has no native libraries for $abi (base/lib/$abi/)")
  done
  grep -q -x -F "$bundle_mapping" <<<"$files" || bundle_problems+=("it has no R8 mapping ($bundle_mapping)")
  grep -q -F "$bundle_symbols" <<<"$files" || bundle_problems+=("it has no native debug symbols ($bundle_symbols)")

  certificate=$("$keytool" -J-Duser.language=en -printcert -jarfile "$build") ||
    cannot_check "Cannot read the signer of $build"
  signers=$(matches -c '^Signer #' <<<"$certificate")
  signer_sha256=$(sed -nE 's/^[[:space:]]*SHA256: ([0-9A-Fa-f:]+)$/\1/p' <<<"$certificate" | head -n 1)
  signer_owner=$(sed -nE 's/^Owner: (.*)$/\1/p' <<<"$certificate" | head -n 1)
  signer_key_bits=$(sed -nE 's/^Subject Public Key Algorithm: ([0-9]+)-bit RSA key.*$/\1/p' <<<"$certificate" | head -n 1)
  signed_with_debug_key=0
  [[ -n $signer_sha256 && $(normalized "$signer_sha256") == $(normalized "$debug_certificate_sha256") ]] &&
    signed_with_debug_key=1
  if [[ -z $signer_sha256 ]]; then
    bundle_problems+=("it is not signed")
  elif [[ $signers -gt 1 ]]; then
    bundle_problems+=("it has $signers signers, not one")
  elif [[ $signed_with_debug_key -eq 1 ]]; then
    echo "$build is signed with the template's debug key ($signer_sha256): for local checks and field tests only, Google Play refuses it."
  else
    echo "$build is signed by $signer_owner ($signer_sha256)."
  fi
  if [[ -n $signer_sha256 && $signers -le 1 ]]; then
    if [[ $upload -eq 0 ]]; then
      [[ $signed_with_debug_key -eq 1 ]] ||
        bundle_problems+=("it is not signed with the template's debug key ($debug_certificate_sha256) but with $signer_sha256: check an upload build with --upload")
    # The debug key is refused before the fingerprint is compared, so that it is named as such even
    # while the upload certificate is a placeholder.
    elif [[ $signed_with_debug_key -eq 1 ]]; then
      bundle_problems+=("it is signed with the debug key, not the upload key")
    elif [[ -z $upload_certificate_sha256 ]]; then
      bundle_problems+=("the upload certificate is still a placeholder in scripts/check-android-release.sh: set it as docs/development/release.md#upload-key describes")
    elif [[ $(normalized "$signer_sha256") != $(normalized "$upload_certificate_sha256") ]]; then
      bundle_problems+=("it is not signed with the upload key: its certificate is $signer_sha256")
    elif [[ -z $signer_key_bits || $signer_key_bits -lt $min_upload_key_bits ]]; then
      bundle_problems+=("its upload key is not an RSA key of at least $min_upload_key_bits bits")
    fi
  fi
fi

listed() {
  local item=$1 candidate
  shift
  for candidate; do
    [[ $candidate == "$item" ]] && return 0
  done
  return 1
}

blocked_found=()
unexpected_found=()
while IFS= read -r permission; do
  if listed "$permission" "${blocked_permissions[@]}"; then
    blocked_found+=("$permission")
  elif ! listed "$permission" "${expected_permissions[@]}"; then
    unexpected_found+=("$permission")
  fi
done <<<"$permissions"

failed=0
if [[ -n $classes || -n $entries ]]; then
  echo "$build contains code or manifest entries that flust must not ship:" >&2
  [[ -n $classes ]] && indent '  class ' <<<"$classes" >&2
  [[ -n $entries ]] && indent '  manifest ' <<<"$entries" >&2
  failed=1
fi
if [[ -n $development_classes ]]; then
  echo "$build contains classes of development modules, which production leaves out:" >&2
  indent '  class ' <<<"$development_classes" >&2
  failed=1
fi
if [[ ${#blocked_found[@]} -gt 0 ]]; then
  echo "$build requests permissions that production builds must not have:" >&2
  printf '  %s\n' "${blocked_found[@]}" >&2
  failed=1
fi
if [[ ${#unexpected_found[@]} -gt 0 ]]; then
  echo "$build requests permissions that are not expected. Block them, or add them to PRODUCTION_ANDROID_PERMISSIONS and to this script with a reason:" >&2
  printf '  %s\n' "${unexpected_found[@]}" >&2
  failed=1
fi
if [[ -n $foreign_services ]]; then
  echo "$build declares VPN services other than the content filter's:" >&2
  indent '  ' <<<"$foreign_services" >&2
  failed=1
fi
if [[ $has_filter -eq 0 ]]; then
  echo "$build does not declare the content filter's VPN service:" >&2
  echo "  $filter_service" >&2
  failed=1
fi
if [[ $has_filter -eq 1 && $filter_type != "$filter_service_type" && $filter_type != "$filter_service_type_flag" ]]; then
  echo "$build does not run the content filter's VPN service in the foreground with the $filter_service_type type:" >&2
  echo "  $filter_service foregroundServiceType=${filter_type:-(missing)}" >&2
  failed=1
fi
if [[ $job_permission != "$filter_restart_job_permission" ]]; then
  echo "$build does not declare the content filter's restart job, bound with $filter_restart_job_permission:" >&2
  echo "  $filter_restart_job permission=${job_permission:-(missing)}" >&2
  failed=1
fi
if [[ ${#missing_filter_permissions[@]} -gt 0 ]]; then
  echo "$build lacks permissions the content filter needs:" >&2
  printf '  %s\n' "${missing_filter_permissions[@]}" >&2
  failed=1
fi
if [[ -n $schemes ]]; then
  echo "$build opens URL schemes, which let any web page detect or open flust:" >&2
  indent '  ' <<<"$schemes" >&2
  failed=1
fi
if [[ ${#identity_problems[@]} -gt 0 ]]; then
  echo "$build is not a production build Google Play accepts:" >&2
  printf '  %s\n' "${identity_problems[@]}" >&2
  failed=1
fi
if [[ ${#unaligned_libraries[@]} -gt 0 ]]; then
  echo "$build has 64-bit native libraries not aligned for 16 KB pages:" >&2
  printf '  %s\n' "${unaligned_libraries[@]}" >&2
  failed=1
fi
if [[ -n $zip_misaligned ]]; then
  echo "$build has entries not aligned in the archive, uncompressed native libraries on 16 KB:" >&2
  indent '  ' <<<"$zip_misaligned" >&2
  failed=1
fi
if [[ ${#bundle_problems[@]} -gt 0 ]]; then
  echo "$build is not a bundle ready for Google Play:" >&2
  printf '  %s\n' "${bundle_problems[@]}" >&2
  failed=1
fi

# The universal APK holds every native library and the merged resources, as the APKs Play
# generates do between them. It goes through the APK checks, and is what the licenses are read
# from, like the release APK.
if [[ $build == *.aab ]]; then
  bundletool build-apks --bundle="$build" --output="$work/universal.apks" --mode=universal >/dev/null ||
    cannot_check "Cannot build the universal APK of $build"
  unzip -p "$work/universal.apks" universal.apk >"$work/universal.apk" ||
    cannot_check "No universal APK in what bundletool built from $build"
  echo
  echo "Universal APK of $build:"
  status=0
  "$0" "$work/universal.apk" || status=$?
  [[ $status -le 1 ]] || exit 2
  [[ $status -eq 0 ]] || failed=1
  echo
  echo "Licenses of $build:"
  status=0
  "$update_licenses" --check --apk "$work/universal.apk" || status=$?
  [[ $status -le 1 ]] || exit 2
  [[ $status -eq 0 ]] || failed=1
fi
[[ $failed -eq 0 ]] || exit 1

echo "$build: no Firebase, Google Play services or Install Referrer code or manifest entries, no development module, only expected permissions, no URL scheme, the content filter's VPN service with its permissions, its foreground type and its restart job, and no other VPN service, the production package and the version of app.json, target API level $target_sdk, and 64-bit native libraries aligned for 16 KB pages."
if [[ $build == *.aab ]]; then
  echo "$build: its universal APK passes the same checks, the Licenses screen matches it, and it carries the native libraries of ${bundle_abis[*]}, its R8 mapping and native symbols."
fi
