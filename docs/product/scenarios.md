# Scenarios

This document lists edge cases and the expected behavior of flust for each of them. It is the reference for tests and for the manual release checklist.

## Time

Rule: store UTC timestamps and recompute durations on display. Never count with a running timer.

| Case                           | Expected behavior                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Daylight saving time change    | The streak stays correct. Durations come from UTC timestamps, so no hour is gained or lost.                            |
| Time zone travel               | The streak duration does not change. Dates and times are displayed in the current time zone.                           |
| Leap years                     | February 29 counts as a normal day.                                                                                    |
| Midnight                       | The day counter changes on elapsed time since the start point, not on calendar midnight.                               |
| Clock moved backwards          | The counter is never negative and never jumps forward when the clock is corrected again.                               |
| Clock moved forwards           | Ranks unlocked while the clock is ahead stay unlocked after it is corrected. See below.                                |
| Lapse logged while clock ahead | The lapse keeps its recorded time. After the clock is corrected, the streak shows 0 until real time reaches it.        |
| Start date in the future       | Refused. The date picker does not allow it and the value is validated before saving.                                   |
| App closed for weeks           | On next launch, the streak and total clean days are recomputed from timestamps, and pending rank unlocks are shown.    |
| Counter reaches 3 and 4 digits | The counter font shrinks so the number fits on one line.                                                               |
| Check-in and time zone travel  | A check-in stays on the local day it was first saved on. Today's check-in is the one stored for the current local day. |
| Check-in open at midnight      | Saving after midnight stores a check-in for the new day. The previous day's check-in is not changed.                   |
| Journal and time zone travel   | A note stays on the local day it was written on, and shows the time it was written at, with the offset of that moment. |
| Journal week start             | "This week" and "Last week" start on the first weekday of the device's region, such as Monday in France.               |
| Journal and clock set back     | A note dated after today shows under "This week". Editing a note never changes its date.                               |

A clock set forwards can unlock ranks early. This is accepted: the app is personal, with no competition, and guarding against it by keeping the latest time ever seen would freeze or distort the counter once the clock is corrected.

## Ranks and lapses

| Case                                | Expected behavior                                                                                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Several ranks unlocked while closed | The unlock screen shows the highest rank and lists the others.                                                                                                                                            |
| Undo a lapse                        | The lapse is removed and the previous streak is restored. Total clean days are recomputed; the rank is left as it is.                                                                                     |
| Undo after midnight                 | The undo is offered until local midnight after the lapse was logged, and never less than an hour after it.                                                                                                |
| Undo after a plan change            | The plan in place before the lapse comes back, unless the plan was edited again since.                                                                                                                    |
| Undo after plans were edited        | Only the plan the lapse changed comes back, and only if it was not edited or removed since. Other plans, including one that moved up to first, are never touched. The last plan is never removed.         |
| Rank reached just after a lapse     | No unlock screen for six hours after the lapse was logged. The rank shows on the badge at once and is announced when the six hours end.                                                                   |
| Two lapses on the same day          | Both are recorded. The streak restarts from the latest one. The rank is not lowered.                                                                                                                      |
| Backdated lapse                     | The lapse is recorded at the chosen time, which cannot be in the future and comes at least a minute after the last lapse or the start point. The streak restarts from that time. The rank is not lowered. |

## Unresponsive user

| Case                               | Expected behavior                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Several reminders ignored in a row | Reminders space out automatically, then one a day at most from the third day without opening the app.                         |
| App not opened for 7 days          | One kind message is sent, "flust is here whenever you like, no pressure", then the app stays silent until it is opened again. |
| Missed check-ins                   | Never shown as failures, in the check-in, the journal or the statistics.                                                      |
| Notification permission refused    | Everything works without it. The reminder stays off, and the reminders screen offers the system settings.                     |
| Onboarding interrupted             | The onboarding resumes at the same step on next launch.                                                                       |
| Onboarding steps skipped           | Skipped steps get default values, which can be changed later in the settings.                                                 |

## Journal

| Case                         | Expected behavior                                                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New note left empty          | The note is never saved and the screen closes without asking. A title without text is never saved, but leaving asks first, so the title is not lost by mistake.                                 |
| Leaving with unsaved changes | The close button, Android back and gestures ask whether to keep writing or discard the changes.                                                                                                 |
| Note too long                | Typing stops at the limit: 120 characters for the title, 10,000 for the text, in UTF-16 units, so an emoji can count twice. A prompt that would not fit is not inserted, and a message says so. |
| Note deleted                 | Deleting asks for confirmation and says it is permanent. The note is removed from the encrypted database.                                                                                       |
| Note deleted while edited    | Saving says the note no longer exists and offers to save the text as a new note.                                                                                                                |
| Note cannot be opened        | A calm message replaces the editor: the note no longer exists, or it could not be read, with a retry.                                                                                           |
| Note opened from a link      | Closing goes back to the journal when there is no screen to go back to.                                                                                                                         |
| Save or delete fails         | A message says so, the text stays on screen and the user can try again.                                                                                                                         |
| Journal cannot be read       | A calm message offers to try again. It never leads to a reset.                                                                                                                                  |
| App closed while writing     | Unsaved text is lost: nothing is written outside the encrypted database before "Save".                                                                                                          |

## Notifications

Notification text is always neutral and never reveals what the app is about.

| Case                                  | Expected behavior                                                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission revoked later              | Every reminder is turned off, in the settings and on their screen, which explains how to allow them again. Allowing them again turns none back on by itself.                 |
| Focus mode                            | Notifications follow the system Focus settings. The app does not try to bypass them.                                                                                         |
| Android reboot                        | Alarms are cleared by the system. flust sets them again after boot, after an update and on next launch.                                                                      |
| Android exact alarm restrictions      | flust never asks for exact alarms. Reminders can arrive a few minutes late, and Doze can batch them.                                                                         |
| Time zone change                      | Reminders keep their wall time, such as 21:00, in the new zone. On Android, flust converts them again when the zone or the clock changes. A rank reminder keeps its instant. |
| Lapse logged                          | No reminder follows a lapse. A rank reached in the six hours after it is announced once they end, in the daytime.                                                            |
| Notification tapped while locked      | The app asks to unlock first, then opens the reminder's screen.                                                                                                              |
| Everything erased                     | Planned and delivered reminders are cancelled before the data is erased.                                                                                                     |
| iOS limit of 64 pending notifications | A plan holds about twenty notifications at most, a week ahead, well under the limit.                                                                                         |

## Lock and encryption

| Case                             | Expected behavior                                                                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Biometrics refused               | The passcode is used.                                                                                                                                                                                         |
| Biometrics unavailable           | The passcode is used.                                                                                                                                                                                         |
| Biometrics changed on the device | The system decides whether biometrics are still trusted, and offers the device passcode otherwise. Data stays readable: the key is not bound to biometrics.                                                   |
| Forgotten passcode               | flust has no passcode of its own. The device passcode is reset through the device, and flust data is not affected.                                                                                            |
| Erase from the settings          | Two steps say what is erased and that it cannot be undone. Storage is closed, the database, its backup and the key are deleted, and the onboarding starts again. If erasing fails, trying again erases again. |
| Failed unlock attempts           | The first two are free. Then each one waits longer: 30 seconds, 1, 5 and 15 minutes, up to 1 hour. Changing the clock does not shorten it, and a restart resumes it. A system interruption does not count.    |
| Device screen lock removed       | The lock is paused, and the settings say so. It works again once a screen lock is set.                                                                                                                        |
| App sent to the background       | Its content is covered at once. Coming back within the chosen delay uncovers it; after it, the app asks again.                                                                                                |
| Link opened while locked         | Nothing opens before the unlock. The link is followed after it.                                                                                                                                               |
| Reinstall on iOS                 | The iOS keychain keeps keys after uninstall. On reinstall, the app detects a stale key with no matching data and replaces it.                                                                                 |
| Phone restored without the key   | The data cannot be decrypted. The app offers a reset.                                                                                                                                                         |
| Any write to storage             | Every write runs in a transaction, so an interrupted write never leaves partial data.                                                                                                                         |
| Schema migration                 | A backup of the data is made on the device before every schema migration.                                                                                                                                     |

## Emergency screen

| Case                             | Expected behavior                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Opened from a notification       | The app asks to unlock first when the lock is on, then opens the emergency screen directly.                                       |
| Phone call or app in background  | The timer counts the time elapsed since the screen opened, so it shows the correct remaining time when the user comes back.       |
| Phone time changed on the screen | The timer and the breathing follow a monotonic clock in the foreground: changing the phone's time neither freezes nor skips them. |
| Reduced motion enabled           | Breathing guidance and transitions use no large movement.                                                                         |
| Countdown reaches zero           | The countdown stays at 00:00 and a calm line asks whether the wave has passed.                                                    |
| App killed on the screen         | The visit stays recorded with its start, without an end or an outcome.                                                            |

## Help resources

| Case                                                              | Expected behavior                                                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| No region on the device                                           | "Another country": 112, with the advice to dial the local number if it does not connect, and the findahelpline.com link.        |
| Region not in the list                                            | The same. When the device is set to an unlisted EU country, 112 is named as the official number.                                |
| Canada, where 911 is not available                                | The 911 row says to dial the local police or emergency number instead.                                                          |
| French overseas department                                        | The French numbers an official page confirms there: all four, except in Mayotte, which shows 3114 and 112.                      |
| Abroad, or a region setting that differs from where the person is | The "Country" row shows another country's numbers. The choice is not stored and the screen opens on the device region again.    |
| App language and region differ                                    | The numbers follow the region, the text follows the language.                                                                   |
| No phone or messages app, such as a tablet                        | A calm line gives the number to dial or text by hand.                                                                           |
| Call or text started                                              | The phone or messages app opens with the number filled in. Nothing is dialed or sent without the person. flust records nothing. |
| Back from a call with the lock on                                 | The chosen lock delay applies, as after any other app.                                                                          |
| Opened from the emergency screen                                  | Help opens over it. The countdown and the visit keep running, and going back returns to them.                                   |
| After a lapse                                                     | The lapse screen shows no help numbers: a lapse is not a crisis.                                                                |
| A number checked over 400 days ago                                | A unit test fails, which blocks CI and the release until the entry is checked against its official source again.                |
| Network                                                           | No request. The findahelpline.com link opens outside flust and carries no country.                                              |

## Devices

| Case                            | Expected behavior                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Small screens (iPhone SE)       | Every screen fits or scrolls. No text or button is cut off.                                                                                                                         |
| Large text sizes                | Text scales with the system setting. Layouts wrap or stack instead of truncating; a few texts in places of fixed size are capped ([0032](../decisions/0032-accessibility-pass.md)). |
| Screen readers                  | Every interactive element and every emblem has a label.                                                                                                                             |
| Orientation                     | Portrait only.                                                                                                                                                                      |
| Low memory and background kills | No data is lost. Drafts and onboarding progress are saved as the user goes.                                                                                                         |
| App update with existing data   | Existing data is migrated and kept.                                                                                                                                                 |

## Languages

| Case                           | Expected behavior                                                             |
| ------------------------------ | ----------------------------------------------------------------------------- |
| Unsupported system language    | The app falls back to English.                                                |
| Device language chosen         | The app follows the phone's language, also after a change made while it runs. |
| Everything erased              | The app goes back to the device language.                                     |
| Plurals                        | Plural forms follow each language's rules ("1 day", "2 days").                |
| 12 and 24 hour formats         | Times follow the device setting.                                              |
| Longer strings, such as German | Layouts allow longer strings without truncation.                              |

## Privacy

| Case             | Expected behavior                               |
| ---------------- | ----------------------------------------------- |
| App switcher     | Content is blurred.                             |
| Network requests | An automated test fails on any network request. |
| Logs             | No personal data is written to logs.            |

## Crashes

There is no remote crash reporting. Errors go to a local, encrypted log without personal data: no message, no user content. The person can read the report and share it through the share sheet; nothing is ever sent by flust. See [0028](../decisions/0028-error-boundaries-and-safe-mode.md) and [0029](../decisions/0029-local-error-log.md).

| Case                                       | Expected behavior                                                                                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Error in a screen                          | That screen shows a calm message with "Try again" and "Back to home". The tab bar and the other screens keep working.                                                                                                           |
| Error in the gates (storage, lock)         | A root message offers "Try again". It shows no data.                                                                                                                                                                            |
| Two launches in a row stop before a screen | The app starts in safe mode, which offers to try again, to see and share the error report, or to erase everything. It shows no data. The report asks for the phone's authentication first, unless the phone has no screen lock. |
| Error report shared                        | The report screen shows the exact text first. It holds times, screens, error types, codes and code locations, never user content.                                                                                               |
| Keystore not readable yet                  | Errors are kept in memory and written to the log once the key can be read.                                                                                                                                                      |
| Everything erased                          | The error log, its key and the launch counter are erased with the rest.                                                                                                                                                         |
| Corrupted settings                         | Settings fall back to their defaults. User data is not affected.                                                                                                                                                                |

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
