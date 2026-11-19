# Features

This document lists flust features by version. Each version builds on the previous one. All features work offline, except the Android filter, which forwards allowed DNS lookups. Every feature stores its data encrypted on the device.

## V0.1

### Onboarding

The onboarding runs once, on first launch. Its steps are:

1. Language: French or English.
2. Reasons: why the user wants to quit.
3. Risk moments: the times and situations where urges are most likely.
4. First if/then plan: "If this happens, then I will do that."
5. Start point: now, or a date in the past, with a Protection card: the app lock and the evening check-in reminder, both off until turned on. Turning the lock on asks the device once; turning the reminder on asks for notifications. Both can be changed later in the settings.

### Home

The home screen shows:

- the name of the current circle,
- the current streak, in a ring that fills toward the next rank, which opens the ranks,
- a rank line with the current rank and the time or days left to the next one, which also opens the ranks,
- a daily quote, on one or two lines,
- the check-in line, then the emergency button that opens the emergency screen and the lapse link, always on screen.

The week strip of the last 7 days is on the ranks tab.

During the first 24 hours of a streak, the counter shows hours and minutes. After that, it shows days.

### Ranks

Ranks reward total clean days. A dedicated screen shows the current rank, the week strip of the last 7 days and all ranks, and a rank unlock screen appears when a new rank is reached. See [Ranks](ranks.md).

### Emergency screen

The emergency screen helps the user get through an urge. It contains:

- a 20 minute urge surfing countdown,
- guided breathing: 4 seconds in, 4 seconds hold, 6 seconds out,
- the user's if/then plan and reasons,
- two exits: "I held on" and "I had a lapse".

Each visit is recorded with its start, end and outcome, for future statistics. Two rows above the exits offer to write a note now, over the screen, and, for dark thoughts rather than urges, to open the help resources over the screen. Other help actions, such as a video from a good day or writing to someone, are added with the features they open.

### Lapse screen

The lapse screen opens when the user logs a lapse. It keeps total clean days and rank, restarts the streak, and offers optional questions. See [Relapse](relapse.md).

### Daily check-in

The check-in records:

- mood, from 1 to 5,
- urge level,
- context chips,
- an optional note.

There is one check-in per local day, editable until local midnight. It never mentions a lapse. Home shows "Ton check-in du jour t'attend" or "Check-in fait" under the quote, and a calm card after several low mood check-ins, which opens the help resources (see [Relapse](relapse.md#special-cases)).

### Journal

A text journal. Each note has an optional title and its text, and keeps the day and the time it was written at. The journal tab lists notes under "Cette semaine", "Semaine dernière", then by month, and opens a note to edit or delete it. Writing prompts insert a starter line, such as "Ce qui m'a fait du bien : ". Notes are stored in the encrypted database.

The emergency screen always offers to open a new note, whatever the plan says.

### Reasons and plans editor

The user can edit their reasons, their risk moments and their if/then plans at any time after the onboarding, from the settings.

- Reasons: add, edit and remove, from the presets or in their own words, like the onboarding. At most 10.
- Risk moments: the chips of the onboarding.
- Plans: several "If … then …" plans, with the plan editor of the onboarding. At most 5, and always at least one. The first plan is the one the lapse screen adjusts; the emergency screen shows them all.

### Settings

The settings show only what works in this version:

- "Besoin d'aide", on its own above the others, which opens the help resources.
- "Raisons et plans", with the number of plans.
- "Rappels": the check-in time, else the thought time, else "Désactivés" when none is on.
- "Verrouillage": the method, "Désactivé" or "En pause".
- "Langue": the device language, French or English, applied at once and stored.
- "À propos": the version, the MPL-2.0 license, links to the website and the source code, the privacy promise in one line, and the error report.
- "Tout effacer": erases every piece of data and the key after two confirmations, then returns to the onboarding.

The filter joins the settings with its feature.

### Reminders

Local reminders, all off until turned on, each with a switch:

- Evening check-in, at a chosen time (21 h by default). Opens the check-in.
- Quote of the day, at a chosen time (08:00 by default).
- Risk hours: before "In bed at night" (22:30) and on "The weekend" (Saturday 10:00), when those risk moments are chosen. Other risk moments have no time. They come at their moment even on a day that already has other reminders.
- Ranks and milestones: when the next rank is reached, in the daytime, never in the six hours after a lapse is logged.

Reminders thin out when the app is not opened, and stop after a week with one last message: "flust is here whenever you like, no pressure." There is no reminder after a lapse. See [0022](../decisions/0022-reminder-schedule.md).

Notification text is always neutral and never reveals what the app is about. It may show on the lock screen, depending on the device's settings: on Android, when sensitive content is shown on the lock screen, which most devices do by default; on iOS, when previews are shown, and a note explains how to hide them. The permission is asked only when a reminder is turned on. A refusal leaves it off, with a way to the system settings. When notifications are no longer allowed, every reminder is turned off, and allowing them again turns none back on by itself.

### App lock

The app is locked with the device's own authentication: biometrics, with the device passcode as fallback. flust has no passcode of its own. The lock asks again after a chosen delay in the background: immediately, after 1, 5 or 15 minutes, or after 1 hour (1 minute by default). Attempts after the first two wait longer each time, up to an hour. Without a screen lock on the device, the lock is paused. See [0023](../decisions/0023-app-lock.md) and [0024](../decisions/0024-lock-wait.md).

In production builds, screenshots are blocked and the app switcher preview is hidden ([0025](../decisions/0025-screen-privacy.md)).

### Help resources

A small list of help numbers, bundled with the app, chosen by the device region, with a row to see another country:

- France: 3114 (suicide prevention, free, 24/7), 15 (SAMU), 112, and 114, a free text message line, 24/7, for deaf or hard of hearing people, or if you cannot speak safely. The same in Guadeloupe, Martinique, Guyane and La Réunion; Mayotte shows 3114 and 112 only, since no official page confirms 15 and 114 there.
- Belgium: the Centre de Prévention du Suicide (0800 32 123), the Zelfmoordlijn (1813), 112 and 101.
- Switzerland: La Main Tendue (143, day and night, anonymous; the call may cost a few centimes depending on the operator), 144, 117 and 112.
- Canada: 988 (call or text) and 911 where available, with the advice to dial the local police or emergency number where it is not.
- United States: 988 (call or text) and 911.
- United Kingdom: Samaritans (116 123), 999 and 112.
- Ireland: Samaritans (116 123), 112 and 999.
- Any other region: 112, named as the official number when the device is set to an unlisted member of the European Union, otherwise with the advice to dial the local number.

Every region also shows a link to findahelpline.com, for helplines in other countries, which opens outside flust.

Buttons open the phone app or the messages app with the number filled in. flust sends nothing and records nothing. Each number keeps its official sources and the day it was checked, and is checked again every year ([0027](../decisions/0027-offline-help-resources.md)). The help resources open from the settings, from the emergency screen and from the low mood card, never from the lapse screen.

### Errors and safe mode

A screen that fails shows a calm message with a retry and a way home, without any data from the failed state. After two launches in a row that stop before the first screen, flust opens in safe mode: try again, see and share the error report, or erase everything.

Errors go to a local, encrypted error report: the last 50, with their time, screen, error type and place in the code, never their message or any user content. "Rapport d'erreurs" in About, and safe mode, show the exact text before the share sheet opens. flust never sends it. See [0028](../decisions/0028-error-boundaries-and-safe-mode.md) and [0029](../decisions/0029-local-error-log.md).

### Encrypted storage

All user data is encrypted at rest. Keys are held by Keychain on iOS and Android Keystore on Android.

### Languages

French and English.

## V0.2

### Content filter

The content filter blocks pornographic sites across the whole phone. The design is in [Content filter](content-filter.md).

- Android uses a local `VpnService` for DNS filtering. Only DNS lookups go through it: blocked ones are answered on the device, allowed ones are sent to Quad9 over DNS over TLS, and no query is logged. The Android build requests `INTERNET` from this version, for the filter only ([0033](../decisions/0033-android-filter-network-access.md)).
- iOS uses the Screen Time APIs (`FamilyControls`, `ManagedSettings`) with Apple's automatic adult filter and up to 45 of our domains. They need an entitlement from Apple. Blocking the removal of flust is possible but off by default.

The filter includes:

- adult site lists under permissive licenses, bundled with the app ([0039](../decisions/0039-filter-lists-and-licenses.md)),
- a category for AI nudify and deepfake sites, on by default, and one for AI companions, off by default and on Android only,
- a strict mode, on by default, that blocks the usual bypasses on Android,
- enforced SafeSearch on Google, Bing, DuckDuckGo and YouTube through DNS, on Android only,
- a 20 minute delay before the filter can be weakened or turned off.

The onboarding gets a filter step.

## V0.3

### Video journal

An encrypted video journal. Videos are recorded in the app and stored encrypted on the device.

## V0.4

### Statistics

- a calendar of clean days,
- streak history,
- frequent contexts,
- risky hours.

### Discreet mode

An alternative app icon and name, and neutral notifications.

### Data management

- encrypted backup,
- export,
- full wipe of all data and keys.

### Help resources

The full list of help resources by country, available offline. V0.1 has a minimal list.

### About page

A fuller page about flust and fnyx-group, beyond the short "À propos" of V0.1.

### Yearly seals

Yearly seals after Free soul: every additional 365 total clean days adds a seal to the rank. See [Ranks](ranks.md#after-free-soul).

## V1.0

Release on the App Store and Google Play under the fnyx-group organization, once the association is registered.
