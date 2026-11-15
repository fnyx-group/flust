# Features

This document lists flust features by version. Each version builds on the previous one. All features work offline and store their data encrypted on the device.

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

- a rank badge with the current rank and progress toward the next one, which opens the ranks,
- the current streak,
- a week strip of the last 7 days, showing clean days,
- a daily quote,
- an emergency button that opens the emergency screen.

The daily check-in will add a single line under the quote.

During the first 24 hours of a streak, the counter shows hours and minutes. After that, it shows days.

### Ranks

Ranks reward total clean days. A dedicated screen lists all ranks, and a rank unlock screen appears when a new rank is reached. See [Ranks](ranks.md).

### Emergency screen

The emergency screen helps the user get through an urge. It contains:

- a 20 minute urge surfing countdown,
- guided breathing: 4 seconds in, 4 seconds hold, 6 seconds out,
- the user's if/then plan and reasons,
- two exits: "I held on" and "I had a lapse".

Each visit is recorded with its start, end and outcome, for future statistics. Help actions, such as a video from a good day, writing to someone or help resources, are added with the features they open.

### Lapse screen

The lapse screen opens when the user logs a lapse. It keeps total clean days and rank, restarts the streak, and offers optional questions. See [Relapse](relapse.md).

### Daily check-in

The check-in records:

- mood, from 1 to 5,
- urge level,
- context chips,
- an optional note.

There is one check-in per local day, editable until local midnight. It never mentions a lapse. Home shows "Check-in du jour · à faire" or "Check-in fait" under the quote, and a calm card after several low mood check-ins (see [Relapse](relapse.md#special-cases)).

### Journal

A text journal. Each note has an optional title and its text, and keeps the day and the time it was written at. The journal tab lists notes under "Cette semaine", "Semaine dernière", then by month, and opens a note to edit or delete it. Writing prompts insert a starter line, such as "Ce qui m'a fait du bien : ". Notes are stored in the encrypted database.

When the user's if/then plan is to write in the journal, the emergency screen offers to open a new note.

### Reasons and plans editor

The user can edit their reasons, their risk moments and their if/then plans at any time after the onboarding, from the settings.

- Reasons: add, edit and remove, from the presets or in their own words, like the onboarding. At most 10.
- Risk moments: the chips of the onboarding.
- Plans: several "If … then …" plans, with the plan editor of the onboarding. At most 5, and always at least one. The first plan is the one the lapse screen adjusts; the emergency screen shows them all.

### Settings

The settings show only what works in this version:

- "Raisons et plans", with the number of plans.
- "Rappels": the check-in time, else the thought time, else "Désactivés" when none is on.
- "Verrouillage": the method, "Désactivé" or "En pause".
- "Langue": the device language, French or English, applied at once and stored.
- "À propos": the version, the MPL-2.0 license, links to the website and the source code, and the privacy promise in one line.
- "Tout effacer": erases every piece of data and the key after two confirmations, then returns to the onboarding.

The filter joins the settings with its feature.

### Reminders

Local reminders, all off until turned on, each with a switch:

- Evening check-in, at a chosen time (21:00 by default). Opens the check-in.
- Quote of the day, at a chosen time (08:00 by default).
- Risk hours: before "In bed at night" (22:30) and on "The weekend" (Saturday 10:00), when those risk moments are chosen. Other risk moments have no time. They come at their moment even on a day that already has other reminders.
- Ranks and milestones: when the next rank is reached, in the daytime, never in the six hours after a lapse is logged.

Reminders thin out when the app is not opened, and stop after a week with one last message: "flust is here whenever you like, no pressure." There is no reminder after a lapse. See [0022](../decisions/0022-reminder-schedule.md).

Notification text is always neutral and never reveals what the app is about. It may show on the lock screen, depending on the device's settings: on Android, when sensitive content is shown on the lock screen, which most devices do by default; on iOS, when previews are shown, and a note explains how to hide them. The permission is asked only when a reminder is turned on. A refusal leaves it off, with a way to the system settings. When notifications are no longer allowed, every reminder is turned off, and allowing them again turns none back on by itself.

### App lock

The app is locked with the device's own authentication: biometrics, with the device passcode as fallback. flust has no passcode of its own. The lock asks again after a chosen delay in the background: immediately, after 1, 5 or 15 minutes, or after 1 hour (1 minute by default). Attempts after the first two wait longer each time, up to an hour. Without a screen lock on the device, the lock is paused. See [0023](../decisions/0023-app-lock.md) and [0024](../decisions/0024-lock-wait.md).

In production builds, screenshots are blocked and the app switcher preview is hidden ([0025](../decisions/0025-screen-privacy.md)).

### Encrypted storage

All user data is encrypted at rest. Keys are held by Keychain on iOS and Android Keystore on Android.

### Languages

French and English.

## V0.2

### Content filter

The content filter blocks pornographic sites on the device.

- Android uses a local `VpnService` for DNS filtering. No traffic leaves the device through the VPN.
- iOS uses the Screen Time APIs (`FamilyControls`, `ManagedSettings`). They require an entitlement from Apple and cannot fully prevent the app from being removed.

The filter includes:

- public NSFW blocklists (HaGeZi, oisd), bundled with the app,
- a separate toggle for AI generators and "nudify" sites,
- enforced SafeSearch on Google, Bing and YouTube through DNS,
- a 20 minute delay before the filter can be turned off.

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

Help resources by country, available offline.

### About page

A fuller page about flust and fnyx-group, beyond the short "À propos" of V0.1.

### Yearly seals

Yearly seals after Free soul: every additional 365 total clean days adds a seal to the rank. See [Ranks](ranks.md#after-free-soul).

## V1.0

Release on the App Store and Google Play under the fnyx-group organization, once the association is registered.
