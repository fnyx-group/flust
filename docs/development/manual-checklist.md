# Manual checklist

The device checks before each release that unit tests and the [Maestro flows](testing.md#end-to-end) cannot cover. Run them on the production release APK ([Release](release.md#local-production-build)), on the `Medium_Phone_API_37.0` emulator unless a step asks for something else. `adb` commands use the production identifier, `org.fnyxgroup.flust`; the checks in [Testing](testing.md) that name `org.fnyxgroup.flust.dev` work the same with it.

Write down the build, the device and any failure in the merge request of the release. A failure blocks the release, like a failing test.

## Android

### First EAS bundle

Once, on the first bundle EAS builds for the stores, then again whenever the build setup changes:

1. Run the release check on the bundle, with `BUNDLETOOL` set ([Setup](setup.md#android-build-tools)). It reads the bundle with `bundletool dump manifest`, a path no local build has used yet:

       scripts/check-android-release.sh path/to/flust.aab

2. It lists the same permissions as the local release APK. Compare them with the list it prints for `android/app/build/outputs/apk/release/app-release.apk`.
3. Turn the bundle into an APK that installs on the emulator, signed with the debug key, and run the flows on it. Uninstall the local build first, which has another signature:

       java -jar "$BUNDLETOOL" build-apks --bundle=path/to/flust.aab --output=/tmp/flust.apks --mode=universal
       unzip -o /tmp/flust.apks universal.apk -d /tmp
       adb uninstall org.fnyxgroup.flust
       scripts/e2e-android.sh --apk /tmp/universal.apk

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

1. Run these twice in a row, the second command as soon as the splash shows:

       adb shell am start -n org.fnyxgroup.flust/.MainActivity
       adb shell am force-stop org.fnyxgroup.flust

2. The third launch opens safe mode, without the app lock.
3. "Try again" starts normally.
4. The error report asks for the phone's authentication, then shows its text before the share sheet opens.
5. Erasing asks twice, then starts the onboarding.
6. The other error checks, the unreadable log file and a screen error on the journal tab, are items 11 and 12 of [Testing](testing.md#storage).

### Storage

The encryption, keystore and backup checks of [Testing](testing.md#storage), items 1 to 3 and 5 to 8 (items 4 and 9 are for iOS).

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
2. The release check passes on the APK: no `INTERNET` permission ([Release](release.md)).
3. On the lock screen, notification texts are neutral and never name the app's purpose.

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

## iOS

After the first iOS build:

1. Face ID: the system asks for permission with the flust text, and unlocking works; the passcode works as a fallback.
2. Notification previews: hidden on the lock screen when Show Previews is set to When Unlocked.
3. App switcher: the preview is hidden.
4. A reinstall with a stale key, and the keychain before the first unlock: [Testing](testing.md#storage), items 4 and 9.
5. VoiceOver and Dynamic Type at the largest sizes: the checks of [Testing](testing.md#accessibility).
