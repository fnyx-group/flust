# Scenarios

This document lists edge cases and the expected behavior of flust for each of them. It is the reference for tests and for the manual release checklist.

## Time

Rule: store UTC timestamps and recompute durations on display. Never count with a running timer.

| Case                           | Expected behavior                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Daylight saving time change    | The streak stays correct. Durations come from UTC timestamps, so no hour is gained or lost.                         |
| Time zone travel               | The streak duration does not change. Dates and times are displayed in the current time zone.                        |
| Leap years                     | February 29 counts as a normal day.                                                                                 |
| Midnight                       | The day counter changes on elapsed time since the start point, not on calendar midnight.                            |
| Clock moved backwards          | The counter is never negative and never jumps forward when the clock is corrected again.                            |
| Clock moved forwards           | Ranks unlocked while the clock is ahead stay unlocked after it is corrected. See below.                             |
| Lapse logged while clock ahead | The lapse keeps its recorded time. After the clock is corrected, the streak shows 0 until real time reaches it.     |
| Start date in the future       | Refused. The date picker does not allow it and the value is validated before saving.                                |
| App closed for weeks           | On next launch, the streak and total clean days are recomputed from timestamps, and pending rank unlocks are shown. |
| Counter reaches 3 and 4 digits | The counter font shrinks so the number fits on one line.                                                            |

A clock set forwards can unlock ranks early. This is accepted: the app is personal, with no competition, and guarding against it by keeping the latest time ever seen would freeze or distort the counter once the clock is corrected.

## Ranks and lapses

| Case                                | Expected behavior                                                                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Several ranks unlocked while closed | The unlock screen shows the highest rank and lists the others.                                                                                                  |
| Undo a lapse                        | The lapse is removed and the previous streak is restored. Total clean days and rank are recomputed.                                                             |
| Undo after midnight                 | The undo is offered until local midnight after the lapse was logged, and never less than an hour after it.                                                      |
| Undo after a plan change            | The plan in place before the lapse comes back, unless the plan was edited again since.                                                                          |
| Rank reached just after a lapse     | No unlock screen for six hours after the lapse was logged. The rank shows on the badge at once and is announced when the six hours end.                         |
| Two lapses on the same day          | Both are recorded. The streak restarts from the latest one. The rank is not lowered.                                                                            |
| Backdated lapse                     | The lapse is recorded at the chosen time, which cannot be in the future or before the start point. The streak restarts from that time. The rank is not lowered. |

## Unresponsive user

| Case                               | Expected behavior                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Several reminders ignored in a row | Reminders space out automatically.                                            |
| App not opened for 7 days          | One kind message is sent, then the app stays silent until it is opened again. |
| Missed check-ins                   | Never shown as failures, in the check-in, the journal or the statistics.      |
| Notification permission refused    | Everything works without it. Reminders are simply not delivered.              |
| Onboarding interrupted             | The onboarding resumes at the same step on next launch.                       |
| Onboarding steps skipped           | Skipped steps get default values, which can be changed later in the settings. |

## Notifications

Notification text is always neutral and never reveals what the app is about.

| Case                                  | Expected behavior                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Permission revoked later              | The app detects it on launch, shows reminders as inactive in the settings and explains how to enable them again. |
| Focus mode                            | Notifications follow the system Focus settings. The app does not try to bypass them.                             |
| Android reboot                        | Scheduled reminders are cleared by the system, so they are rescheduled after boot and on next launch.            |
| Android exact alarm restrictions      | Reminders still work when exact alarms are not allowed, with a possible delay.                                   |
| iOS limit of 64 pending notifications | The app never schedules more than 64 notifications. It schedules the nearest ones and tops up on each launch.    |

## Lock and encryption

| Case                             | Expected behavior                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Biometrics refused               | The passcode is used.                                                                                                         |
| Biometrics unavailable           | The passcode is used.                                                                                                         |
| Biometrics changed on the device | The passcode is required before biometrics are trusted again.                                                                 |
| Forgotten passcode               | The data cannot be recovered. This is stated during onboarding. A full wipe is offered.                                       |
| Failed unlock attempts           | A growing delay is applied after each failed attempt.                                                                         |
| Reinstall on iOS                 | The iOS keychain keeps keys after uninstall. On reinstall, the app detects a stale key with no matching data and replaces it. |
| Phone restored without the key   | The data cannot be decrypted. The app offers a reset.                                                                         |
| Any write to storage             | Every write runs in a transaction, so an interrupted write never leaves partial data.                                         |
| Schema migration                 | A backup of the data is made on the device before every schema migration.                                                     |

## Emergency screen

| Case                            | Expected behavior                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Opened from a notification      | The app unlocks, then opens the emergency screen directly.                                         |
| Phone call or app in background | The timer is based on timestamps, so it shows the correct remaining time when the user comes back. |
| Reduced motion enabled          | Breathing guidance and transitions use no large movement.                                          |
| Countdown reaches zero          | The countdown stays at 00:00 and a calm line asks whether the wave has passed.                     |
| App killed on the screen        | The visit stays recorded with its start, without an end or an outcome.                             |

## Devices

| Case                            | Expected behavior                                                           |
| ------------------------------- | --------------------------------------------------------------------------- |
| Small screens (iPhone SE)       | Every screen fits or scrolls. No text or button is cut off.                 |
| Large text sizes                | Text scales with the system setting. Layouts wrap instead of truncating.    |
| Screen readers                  | Every interactive element and every emblem has a label.                     |
| Orientation                     | Portrait only.                                                              |
| Low memory and background kills | No data is lost. Drafts and onboarding progress are saved as the user goes. |
| App update with existing data   | Existing data is migrated and kept.                                         |

## Languages

| Case                           | Expected behavior                                              |
| ------------------------------ | -------------------------------------------------------------- |
| Unsupported system language    | The app falls back to English.                                 |
| Plurals                        | Plural forms follow each language's rules ("1 day", "2 days"). |
| 12 and 24 hour formats         | Times follow the device setting.                               |
| Longer strings, such as German | Layouts allow longer strings without truncation.               |

## Privacy

| Case             | Expected behavior                               |
| ---------------- | ----------------------------------------------- |
| App switcher     | Content is blurred.                             |
| Network requests | An automated test fails on any network request. |
| Logs             | No personal data is written to logs.            |

## Crashes

There is no remote crash reporting. Errors go to a local log without personal data. The user can export it and send it manually.

| Case                            | Expected behavior                                                              |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Error in a screen               | An error boundary per screen shows a message with a retry button.              |
| Two crashes in a row at startup | The app starts in safe mode, which offers to export the data or reset the app. |
| Corrupted settings              | Settings fall back to their defaults. User data is not affected.               |

## Later versions

### V0.2 content filter

| Case                                      | Expected behavior                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| VPN killed by the system on Android       | The app detects it and shows that the filter is inactive.                                         |
| Another VPN active on Android             | Only one VPN can run at a time. The app shows that the filter is inactive and explains why.       |
| Android Private DNS overriding the filter | The app detects it and explains how to turn Private DNS off.                                      |
| Browsers using DNS over HTTPS             | The app explains that these browsers bypass the filter and how to disable DNS over HTTPS in them. |
| iOS Screen Time authorization revoked     | The app detects it and shows that the filter is inactive.                                         |
| Delay bypass through clock changes        | Changing the device clock does not shorten the 20 minute delay.                                   |

### V0.3 video journal

| Case                         | Expected behavior                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Camera or microphone refused | The app explains why access is needed. The text journal stays available.              |
| Storage full                 | Recording does not start, or stops and keeps what was recorded. The user is told why. |
| Call during recording        | Recording stops and what was recorded is kept, encrypted.                             |

## Production incidents

- Releases use a phased rollout on both stores.
- A hotfix goes through a hotfix branch and a new store release.
- There are no over-the-air updates, since they need network access.
- Security issues follow [SECURITY.md](../../SECURITY.md).
- User reports come through the support page, with an optional exported log.

## Testing tools

- Jest with fast-check for property-based tests of date and rank logic.
- React Native Testing Library for screens.
- Maestro for end-to-end flows.
- A manual checklist on a real iPhone and a real Android device before each release.
