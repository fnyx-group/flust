# 0047 Foreground service and restart jobs of the Android filter

## Context

On a Xiaomi Poco F4 (HyperOS, Android 14), swiping flust away from recents killed its process (`ProcessSceneCleaner: SwipeUpClean`), and the VPN disconnected 80 ms later. Nothing restarted it, not even with always-on VPN, autostart allowed and no battery restriction. On stock Android the filter survived a swipe. Huawei, Honor, OnePlus, Oppo, Realme, Vivo and Samsung are known to kill background work in similar ways.

The VPN service then ran as a plain started service in the app's process, and nothing ran after a kill except flust's own resume when the person opened it again.

Two experiments ran on that phone, with field APKs and a log that only lasted for the test:

1. The VPN service in a process of its own (`android:process=":filter"`). HyperOS killed both processes on a swipe, 2 ms apart, the filter's at `adj 200`. The split also moved the status the app reads into another process. It was reverted.
2. The VPN service in the foreground, with restart jobs. No kill at all: `onTaskRemoved` ran, the one-off job ran three seconds later and found the filter running, and the process kept its pid. Swiping and closing all recents kept the filter blocking. The notification permission was not granted, so no notification showed, and the foreground service still protected the filter.

On the API 37 emulator, `am crash` ended flust's process and Android did not restart the service. A forced run of the periodic job started a new process, which started the service in the foreground from the background, and the filter blocked again within two seconds, with the notification's words in the language chosen in flust.

## Decision

- `FilterVpnService` runs in the foreground, in the app's process, with the `systemExempted` type from Android 14. Android reserves that type for a few kinds of apps, VPN apps among them ([Foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types)). The manifest declares it, with `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SYSTEM_EXEMPTED`. The release check fails on a build whose filter service lacks the permissions or has another type than `systemExempted`, or that lacks the restart job bound with `BIND_JOB_SERVICE`.
- Every start goes through `startForegroundService`, and the service calls `startForeground` as soon as it has read its settings, for every start but a stop. On Android 8 to 11 a foreground start is allowed from the background. From Android 12, Android's documented exemptions do not cover jobs, but its code exempts an app that holds the VPN consent (`REASON_OP_ACTIVATE_VPN` in `ActiveServices`). A start that is still refused is caught and logged in the development build.
- A refused foreground stops the service, with its tunnel closed and the `failed` stop reason, when the start came from `startForegroundService`: Android does not let such a start go unanswered, and ends the app when the service stops without answering it too, but the tunnel is then closed and the reason recorded first. The filter stays on in the settings and the restart jobs stay, so they try again. The sticky restart and the always-on setting start the service with `startService`: refused the foreground, the filter runs in the background, as before this change (`StartDecision`).
- The notification:
  - One channel, "Service en arrière-plan" or "Background service", of low importance, silent, without vibration or badge, hidden on the lock screen (`VISIBILITY_SECRET`). The text, "Actif en arrière-plan" or "Running in the background", does not say what flust is for. A tap opens flust.
  - flust never asks for the notification permission for it. Without the permission, with the channel turned off, or with the notification swiped away on Android 14 and later, the service stays in the foreground and keeps filtering.
  - The words come from the app's translations, in the language chosen in flust, as for the reminders. The app passes them with each start and through `describe` at launch and at each change of language. The filter keeps them with its settings, encrypted, so that a start without the app, at boot, by always-on or by a job, uses them too. A built-in English text is used only when no words were ever stored. New words alone never set up a new tunnel (`FilterConfig.filtering`).
- The settings are read, changed and written under one lock per process (`FilterSettingsFile`), since the module, the service and the jobs write them from different threads. A read that fails, such as a passing Keystore error, gives the defaults with the filter off to act on, and is never saved: every writer skips its write, the app reports a failed start or stop, and the service keeps a running tunnel with the settings it has, or stops with the `failed` reason and keeps the restart jobs.
- `FilterRestartJob`, a JobService, is the safety net behind the foreground service:
  - A one-off job, three seconds after flust leaves recents (`onTaskRemoved` of the service, and the end of the activity), at the latest 15 seconds after.
  - A periodic job every 15 minutes, kept across reboots, scheduled once the tunnel runs and cancelled only when the filter is turned off.
  - Each run starts the filter only when it was left on, the VPN consent still holds and no tunnel runs (`RestartDecision`).
- The development build logs the restart events with the filter's other events (`FlustFilter`): a job scheduled, a decision, a start accepted or refused, the tunnel running again, a foreground start refused. Only fixed words and exception classes, as for the stop reasons. The production build logs nothing.
- The process split stays rejected, and no guidance per manufacturer is shown for now. It is added if a full day with the screen off, on the Poco F4 or another brand, shows a kill.

## Consequences

- Google Play asks for a declaration of the foreground service types in the Play Console, besides the VpnService one: what the service does, the impact on the person if Android defers or interrupts it, and a video ([Google Play VpnService declaration](../release/google-play-vpn-declaration.md#foreground-service-declaration)).
- A person who allows notifications sees a silent one while the filter runs. They can turn its channel off in Android's settings without losing the protection.
- Jobs survive a kill, not a force stop, which also cancels them. After a force stop, the filter comes back when flust opens, or with always-on VPN.
- The periodic job wakes flust every 15 minutes at most, less often in Doze and in the rarer standby buckets. A run that finds the filter running does nothing else.
- Settings written before this change have no notification words: the English text shows until flust opens once.
