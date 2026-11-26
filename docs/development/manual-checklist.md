# Manual checklist

The device checks before each release that unit tests and the [Maestro flows](testing.md#end-to-end) cannot cover. Run them on the field APK of the release bundle ([Release](release.md#field-tests)), on the `Medium_Phone_API_37.0` emulator unless a step asks for something else. `adb` commands use the production identifier, `org.fnyxgroup.flust`; the checks in [Testing](testing.md) that name `org.fnyxgroup.flust.dev` work the same with it.

Write down the build, the device and any failure in the merge request of the release. A failure blocks the release, like a failing test.

## Android

### First bundle

Once, on the first bundle built for Google Play, then again whenever the build setup changes:

1. Build it with `scripts/build-android-bundle.sh --field-apk` ([Release](release.md#android-bundle)). The permissions the check lists for the bundle are the same as for the local release APK.
2. Install the field APK on the emulator and run the flows on it, as in [Field tests](release.md#field-tests).

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

### Content filter on the emulator

These run on the production APK of [Release](release.md#local-production-build), installed with `adb install -r android/app/build/outputs/apk/release/app-release.apk`. The `adb` commands use `org.fnyxgroup.flust`. Steps 2 and 3 need the development build, which has the measure of the lists and the filter's log. The measurements on a real phone, a network that blocks port 853 and an app that queries a resolver directly belong to the field tests of lot 4.

1. A fresh install: the onboarding shows "Un filtre pour tout le téléphone" after the plan, with the disclosure in full. "Plus tard" goes on to the start, and Settings, Filtre reads Désactivé.
2. Development build: Filtre, Mesurer les listes: 304,083 domains, 2,673 KB. Write down the load time and the cost per name. Before the filter starts, the second line says the tunnel has not started. Turn the filter on and measure again: the second line gives the last start's total, then its lists, certificates and tunnel. Turn Strict YouTube on and measure: the lists read as already loaded, and the start is shorter. The third line names the resolver in use: Quad9, or Cloudflare from France after 24 November 2026, and no resolver while the filter is off.
3. Development build: the Filtre row and screen work as in production, with the measure at the bottom. Turn the filter on, then off: `adb logcat -d -s FlustFilter` shows `Tunnel stopped: stopped`, and nothing else from the filter. On the production APK, the same command shows nothing.
4. Turn the filter on from its screen: the disclosure sheet shows first, then Android's VPN dialog. After OK, the state reads that the filter protects, and the key icon shows in the status bar.
5. Blocking: `adb shell ping -c 1 pornhub.com` and `www.pornhub.com` answer `unknown host`, and Chrome shows `ERR_NAME_NOT_RESOLVED`. `cloth-off.io` and `janitorai.com` too. `adb shell ping -c 1 wikipedia.org` and `character.ai` resolve, and Wikipedia loads in Chrome.
6. SafeSearch: `adb shell ping -c 1 www.google.com` resolves to `forcesafesearch.google.com`'s address, and a Google search shows SafeSearch locked on. `www.bing.com` resolves to `strict.bing.com`'s address and `duckduckgo.com` to `safe.duckduckgo.com`'s. `www.youtube.com` resolves to `restrictmoderate.youtube.com`'s address.
7. Strict YouTube, at once: resolve `www.youtube.com` once, then turn Strict YouTube on, and resolve it again right away: it gives `restrict.youtube.com`'s address, not the cached one. `adb shell dumpsys connectivity | grep -i -A3 'VPN'` shows the other fake DNS address, `10.111.222.3` or `.2`, after each change.
8. Strict mode: `dns.google`, `dns.quad9.net` and `use-application-dns.net` answer `unknown host`, while other names still resolve.
9. Chrome's secure DNS: in Chrome, Settings, Privacy and security, Use secure DNS, choose a custom provider `https://dns.google/dns-query`. Browsing in Chrome stops. The filter screen's help line says how to fix it; set it back to Automatic and pages load again.
10. Private DNS: Settings, Network and internet, Private DNS, Automatic: names still resolve without delay, blocked ones stay blocked. Hostname `dns.google`: within two seconds the filter screen reads that the filter does not protect, with the Private DNS reason and "Ouvrir les réglages", which opens the network settings, and home shows the "Filtre inactif" chip in place of the circle name. Set it back to Automatic: both go back to normal.
11. Home at 667 points: on an emulator 667 points tall (a 1334 by 750 pixel screen at 320 dpi, `adb shell wm size 750x1334` and `adb shell wm density 320`), home with the chip does not scroll. `adb shell wm size reset` and `adb shell wm density reset` after.
12. Delay, then confirm: turn the filter off. The state reads "Le filtre se désactive dans 20 min." and the filter still blocks. Wait 20 minutes with the screen off for part of it: "Les 20 minutes sont passées" shows with "Confirmer". Confirm in the sheet: the key icon goes away and `pornhub.com` resolves.
13. Expiry: turn the filter on, ask to turn it off, wait 31 minutes away from flust, then open it: the request is gone and the filter is on.
14. Clock changes during the wait: `adb root`, ask to turn the filter off, then `adb shell date 010100002030` (forward) and `adb shell am force-stop org.fnyxgroup.flust`; open flust: the wait has not moved. Set the date back with `adb shell date` to the real time, or turn automatic time back on.
15. Reboot during the wait: ask to turn the filter off, wait 2 minutes, `adb reboot`, wait 5 minutes, open flust: the wait left is about 18 minutes minus the time since boot, never less.
16. Strict YouTube's delay: turning it off waits like the filter, and its switch stays on until confirmed.
17. Nothing about the lookups is logged: `adb logcat -d | grep -i -E 'pornhub|wikipedia'` finds nothing from flust.
18. Always-on: the "VPN permanent" row opens Settings, Network, VPN, where flust's gear offers Always-on VPN and Block connections without VPN.
19. Force stop: `adb shell am force-stop org.fnyxgroup.flust` removes the key icon. Open flust: the filter comes back on.
20. Foreground: with the filter on, `adb shell dumpsys activity services org.fnyxgroup.flust | grep isForeground` reads `isForeground=true`, with `types=0x00000400`, the `systemExempted` type, on Android 14 and later.
21. Swipe from recents: open flust, then swipe it away from recents. The key icon stays and `pornhub.com` does not resolve. Do it again with "Close all" in recents.
22. Kill: `adb shell am crash org.fnyxgroup.flust` ends the process, as a manufacturer's kill does, on images where `adb root` is refused. On the API 37 emulator, Android did not restart the service after it: the key icon goes away and `pornhub.com` resolves until a restart job runs.
23. Restart jobs: with the filter on, `adb shell cmd jobscheduler get-job-state org.fnyxgroup.flust 4606978` reads `waiting`, the periodic job. Kill flust as above, then `adb shell cmd jobscheduler run -f org.fnyxgroup.flust 4606978`: within two seconds a new pid shows in `adb shell pidof org.fnyxgroup.flust`, the service is in the foreground again and `pornhub.com` does not resolve, without opening flust. After a swipe from recents, `adb shell dumpsys jobscheduler | grep 4606977` shows the one-off job started and stopped a few seconds later. In the development build, `adb logcat -d -s FlustFilter` shows `Restart: job-periodic start accepted`, then `Restart: tunnel running after job-periodic`. Once the filter is off, `get-job-state` finds no job.
24. Notifications refused: with the notification permission denied (`adb shell pm revoke org.fnyxgroup.flust android.permission.POST_NOTIFICATIONS`), turn the filter on: no notification shows, the service is still in the foreground as above, and the filter blocks. flust never asks for the permission on the filter screen.
25. Notification allowed: grant the permission (`adb shell pm grant org.fnyxgroup.flust android.permission.POST_NOTIFICATIONS`) and open flust. A silent notification, "Actif en arrière-plan", shows under the channel "Service en arrière-plan", and nothing of it shows on the lock screen. Switch flust to English in its settings: both read in English at once, "Running in the background" and "Background service". Kill flust and run the periodic job as above, or reboot, without opening flust: the notification keeps the language chosen in flust.
26. Channel off: turn the "Service en arrière-plan" channel off in Android's settings for flust. The notification goes away, the service stays in the foreground and the filter blocks. Kill flust and run the periodic job as above: it comes back in the foreground, still without a notification. On Android 14 and later, swiping the notification away also keeps the filter.
27. Reboot: `adb reboot`, then, without opening flust, `adb shell ping -c 1 pornhub.com` answers `unknown host` once the phone is up. If Android refused the start, flust reads that the filter resumes when it opens, not an error, and opening it brings the filter back.
28. Turned off in the system: disconnect the VPN in Settings, Network, VPN. The filter screen reads that it was turned off in Android's settings, with "Réactiver le filtre", which brings it back without a dialog.
29. Another VPN: install a second VPN app and connect it. The filter screen reads that another VPN took over; "Réactiver le filtre" shows the disclosure, then Android's dialog, and the other VPN disconnects.
30. Licenses: About, Licences shows two groups. Listes du filtre: ShadowWhisperer (Unlicense), Sinfonietta and 4skinSkywalker (MIT) and aegis (CC0-1.0). Bibliothèques de l'app: the libraries with their version and license, from `@expo-google-fonts/barlow-condensed` to `Zstandard`. A tap on a row shows its text, another hides it, and TalkBack reads whether it is expanded.
31. The release check passes on the production APK: `scripts/check-android-release.sh android/app/build/outputs/apk/release/app-release.apk` lists `INTERNET`, `ACCESS_NETWORK_STATE`, `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SYSTEM_EXEMPTED`, and the filter's VPN service.

## iOS

After the first iOS build:

1. Face ID: the system asks for permission with the flust text, and unlocking works; the passcode works as a fallback.
2. Notification previews: hidden on the lock screen when Show Previews is set to When Unlocked.
3. App switcher: the preview is hidden.
4. Opening `flust://emergency` in Safari does nothing. The absence of `CFBundleURLTypes` in the built `Info.plist` is checked in CI ([0035](../decisions/0035-no-url-scheme-in-production.md)).
5. The relock after a sleep with the date moved back, as on Android ([Lock](#lock), items 3 and 4), which also checks that the clock of `modules/flust-privacy` counts sleep on iOS.
6. A reinstall with a stale key, and the keychain before the first unlock: [Testing](testing.md#storage), items 4 and 9.
7. VoiceOver and Dynamic Type at the largest sizes: the checks of [Testing](testing.md#accessibility).
