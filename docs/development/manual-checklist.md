# Manual checklist

The device checks before each release that unit tests and the [Maestro flows](testing.md#end-to-end) cannot cover. Run them on the production release APK ([Release](release.md#local-production-build)), on the `Medium_Phone_API_37.0` emulator unless a step asks for something else. `adb` commands use the production identifier, `org.fnyxgroup.flust`; the checks in [Testing](testing.md) that name `org.fnyxgroup.flust.dev` work the same with it.

Write down the build, the device and any failure in the merge request of the release. A failure blocks the release, like a failing test.

## Android

### First EAS bundle

Once, on the first bundle EAS builds for the stores, then again whenever the build setup changes:

1. Run the release check on the bundle, with `BUNDLETOOL` set ([Setup](setup.md#android-build-tools)). It reads the bundle with `bundletool dump manifest`, a path no local build has used yet:

       scripts/check-android-release.sh path/to/flust.aab

2. It lists the same permissions as the local release APK. Compare them with the list it prints for `android/app/build/outputs/apk/release/app-release.apk`.
3. Turn the bundle into an APK that installs on the emulator, signed with the debug key of the generated project, the same as the local release APK, and run the flows on it. Without `--ks`, bundletool looks for `~/.android/debug.keystore`, which the container's home folder does not have:

       out=$(mktemp -d)
       java -jar "$BUNDLETOOL" build-apks --bundle=path/to/flust.aab --output="$out/flust.apks" --mode=universal \
         --ks=android/app/debug.keystore --ks-pass=pass:android --ks-key-alias=androiddebugkey --key-pass=pass:android
       unzip -o "$out/flust.apks" universal.apk -d "$out"
       scripts/e2e-android.sh --apk "$out/universal.apk"

### Install and update

1. Fresh install: the onboarding starts, in the device language.
2. Update over the previous release with data: the data is kept, and the [migration checks](testing.md#storage) (items 6 and 7) pass when the schema changed.
3. Installing an older release over this one is refused by Android; uninstalling erases everything.

### Startup

1. Cold start: the splash shows the symbol (Android 12 and later), then the first screen, with no blank frame.
2. In airplane mode: a first launch and a relaunch work ([Testing](testing.md#storage), item 10).
3. Low memory: open a note draft and the onboarding halfway, then kill the app from the background with `adb shell am kill org.fnyxgroup.flust`. Both come back as they were.

### Safe mode

No code can trigger it: the app is stopped during the splash twice instead ([0028](../decisions/0028-error-boundaries-and-safe-mode.md)).

1. Turn the app lock on first, so that safe mode is seen to open without it.
2. Do item 12 of [Testing](testing.md#storage) with the production identifier, plus item 11. A release build reaches its first screen quickly, so start and stop it in one command, run twice:

       adb shell 'am start -n org.fnyxgroup.flust/.MainActivity; sleep 0.3; am force-stop org.fnyxgroup.flust'

3. The third launch opens safe mode, without the app lock. Erasing there asks twice.

### Storage

The encryption, keystore and backup checks of [Testing](testing.md#storage), items 1 to 3 and 5 to 8 (items 4 and 9 are for iOS), plus a migration backup cut short ([0011](../decisions/0011-encrypted-sqlite-storage.md)):

1. With some data in flust, stop it:

       adb shell am force-stop org.fnyxgroup.flust

2. Put a truncated copy of the database at the backup's name. The whole command is quoted, so the redirection runs inside `run-as`, as the app:

       adb shell "run-as org.fnyxgroup.flust sh -c 'head -c 4096 files/SQLite/flust.db > files/SQLite/flust.db.pre-migration'"

3. Launch flust: the data is still there.
4. The backup is gone, and no `-journal`, `-wal` or `-shm` file is left under its name:

       adb shell "run-as org.fnyxgroup.flust ls files/SQLite"

5. The error report lists one `backup-discarded` entry, with no other detail.

### Lock

The wait between attempts ([0024](../decisions/0024-lock-wait.md)), with the lock on:

1. Cancel the system prompt three times: the third shows a 30 second wait.
2. With a wait running, move the clock forward in the system settings: the wait does not get shorter.

The relock after time away ([0023](../decisions/0023-app-lock.md)), with the lock on and a 1 minute delay:

3. Leave flust, lock the phone and let it sleep for more than a minute. On the emulator, `adb shell input keyevent KEYCODE_SLEEP`, wait, then `adb shell input keyevent KEYCODE_WAKEUP`.
4. Before going back to flust, move the date back a day in the system settings. Back in flust, it asks to unlock.

### Reminders

Taps on a notification ([0021](../decisions/0021-local-notifications.md)), with the evening check-in reminder on:

1. Tap the reminder when it comes: flust opens on the check-in, through the lock when it is on.
2. Then leave flust and reopen it from the recent apps: it opens where it was, not on the check-in again.

### Reboot

1. With the evening check-in reminder on, reboot the emulator: the reminder still comes at its time.
2. With the lock on and a wait running after failed attempts, reboot: the wait goes on where it was, and does not start again from zero.

### Time

1. Change the time zone in the system settings: reminders keep their wall time, and notes keep the date and time they were written at.
2. Across a daylight saving change (set the date and zone just before one): the streak counts elapsed time, with no hour gained or lost.
3. Set the clock back, then forward: the streak never goes negative, and a lapse in the future is refused with its message.
4. Leave the check-in open across local midnight, then save: it is stored for the new day, and the previous day's check-in is unchanged ([Scenarios](../product/scenarios.md)).

### Permissions

1. Turn the notifications off for flust in the system settings: the reminders screen says so and offers to open the settings.
2. Remove the screen lock with the app lock on: the lock shows as paused, and flust opens without asking.
3. Enroll or remove a fingerprint: the lock row names the new method, and unlocking works.

### Privacy

1. A screenshot of flust is refused, and the recent apps preview is blank.
2. From a cold start (`adb shell am force-stop org.fnyxgroup.flust`, then open flust), open the recent apps during the splash screen: the preview is already blank ([0025](../decisions/0025-screen-privacy.md)).
3. The release check passes on the APK: no `INTERNET` permission and no URL scheme ([Release](release.md)).
4. No URL opens flust ([0035](../decisions/0035-no-url-scheme-in-production.md)). Each of these reports that the intent cannot be resolved, and flust does not open:

       adb shell am start -a android.intent.action.VIEW -d flust://emergency
       adb shell am start -a android.intent.action.VIEW -d exp+flust://emergency

5. On the lock screen, notification texts are neutral and never name the app's purpose.
6. Keyboard learning ([0036](../decisions/0036-keyboard-learning.md)), with Gboard: focus each text field in turn, a note's title and text, the check-in note, and a custom reason and plan in the onboarding and in the settings. Gboard shows its incognito icon on each one. With a field focused, the flag is set, `0x1000000` in the options:

       adb shell dumpsys input_method | grep -o 'imeOptions=0x[0-9a-f]*'

### Accessibility

The text size, TalkBack and Remove animations checks of [Testing](testing.md#accessibility), plus:

1. Run the flows with the largest text: `scripts/e2e-android.sh --font-scale 2.0`.
2. On a 360 point wide screen, every screen fits or scrolls, with nothing cut off.

TalkBack is in Settings, Accessibility, TalkBack. The font scale can be set with `adb shell settings put system font_scale 2.0`, and `1.0` to go back.

### Help

1. A call row opens the dialer with the number, and a text row the messages app. Nothing is dialed or sent.
2. On a device without a phone app, such as a tablet emulator, the row shows the number to dial by hand.

### Languages

1. French and English: every screen reads in the chosen language.
2. With "Device language" chosen, change the phone's language while flust runs: flust follows it ([Scenarios](../product/scenarios.md)).
3. Times, in both languages, with the phone on a 24 hour then a 12 hour clock: the reminders value and time chips, a note's date and the lapse time. French on 24 hours reads "21 h" and "21 h 14", English "21:14", and a 12 hour clock the platform's "9:14 PM" in both. Unit tests format times with Node's locale data, which can differ from the phone's.

## iOS

After the first iOS build:

1. Face ID: the system asks for permission with the flust text, and unlocking works; the passcode works as a fallback.
2. Notification previews: hidden on the lock screen when Show Previews is set to When Unlocked.
3. App switcher: the preview is hidden.
4. Opening `flust://emergency` in Safari does nothing. The absence of `CFBundleURLTypes` in the built `Info.plist` is checked in CI ([0035](../decisions/0035-no-url-scheme-in-production.md)).
5. The relock after a sleep with the date moved back, as on Android ([Lock](#lock), items 3 and 4), which also checks that the clock of `modules/flust-privacy` counts sleep on iOS.
6. A reinstall with a stale key, and the keychain before the first unlock: [Testing](testing.md#storage), items 4 and 9.
7. VoiceOver and Dynamic Type at the largest sizes: the checks of [Testing](testing.md#accessibility).
