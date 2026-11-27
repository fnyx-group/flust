# 0049 Filter restart after a crash, always-on status and unused app pause

## Context

A field test on a Xiaomi Poco F4 (HyperOS, Android 14) showed three gaps in how the filter survives.

1. The filter runs in the app's process ([0047](0047-filter-foreground-service.md)), so a crash of the interface ends it too. On the API 37 emulator, after `am crash` with the filter started from the app, Android kept the service record with `crashCount=1` and no restart planned: the filter stayed off until the periodic job, up to 15 minutes later.
2. The filter screen opens Android's VPN settings for always-on. Tapping flust's name there does not lead to the setting: Android opens flust when the VPN is off, and offers to disconnect it when it is on. Only the gear next to the name opens the page with "Always-on VPN". No public intent opens that page for one app.
3. "Pause app activity if unused" is on by default. On Android 11 it only resets runtime permissions, which the filter does not use. From Android 12 it hibernates the app. On the emulator, with the unused threshold set to one second, Android's hibernation check listed flust as unused while its VPN was running: the VPN service bound by the system does not count as use. It skipped flust only because a foreground service was running at that moment ("running with importance 125"). Hibernation acts like a force stop: the filter stops, the restart jobs are cancelled and runtime permissions are reset ([App hibernation](https://developer.android.com/topic/performance/app-hibernation)). A check that runs while the filter is down, after a crash or a manufacturer's kill, would leave it off until flust is opened.

## Decision

- `CrashRestart` installs a default uncaught exception handler, from the module when the app starts and from the VPN service when it starts without the app. Before handing over to the previous handler, which ends the process as before (`CrashHandler`), it schedules the one-off restart job when the crash takes a running tunnel or a start under way with it: a second later, or a minute later after another crash within the last minute (`CrashRestartDecision`). A start is under way from the moment the service begins preparing it until its tunnel is set up or has failed (`TunnelStarts`), so a crash while the lists load, or while the tunnel is set up, also brings the filter back, and a filter that keeps crashing, at start or once running, restarts once a minute at most. Without a tunnel or a start, nothing is scheduled. The time of the last schedule is written with `commit`, since the process is about to end. Without a previous handler, which Android always sets, the crash is printed as Java does when there is none: `ThreadGroup.uncaughtException` would call the default handler again, which is this one.
- The filter screen shows whether always-on names flust, which the running service reads with `VpnService.isAlwaysOn()` from Android 10. Until it is on, one line says to tap the gear next to flust.
- When the filter is on and Android would pause flust if unused (`PackageManager.isAutoRevokeWhitelisted()` is false, from Android 12), the filter screen shows one row that opens the setting (`IntentCompat.createManageUnusedAppRestrictionsIntent`), with one line on why. The row goes away once the person turns the pause off.

## Consequences

- Measured on the API 37 emulator, release build:
  - A crash in the background: no dialog, the filter blocked again 6 seconds later, in a new process started by the job.
  - A crash Android answers with its "keeps stopping" dialog: the process lives, and the filter keeps blocking, until the dialog is closed. The one-off job, due while the dying process still held it, ran 17 seconds after the dialog closed.
  - Two crashes within a minute: Android did not mark flust as a bad process. When the second crash took a service the job had started, Android restarted it itself a second later, before the job planned a minute later. A forced run of the periodic job also started it again in a second.
- An exception in JavaScript reaches the handler too: React Native turns a fatal one into a `JavascriptException` on its native thread.
- Turning the filter off saves the setting, then asks the service to stop. When that request throws, the setting is turned back on and the app says the filter stays on, so the setting never says off while the tunnel runs.
- Turning always-on off in Android's settings stops the VPN; the filter comes back with the jobs or when flust opens.
- The pause row adds no permission: the check and the intent need none.
- Manufacturers can kill or pause apps in their own ways. Guidance for them comes with the final test on the phone.
