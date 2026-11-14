# Features

This document lists flust features by version. Each version builds on the previous one. All features work offline and store their data encrypted on the device.

## V0.1

### Onboarding

The onboarding runs once, on first launch. Its steps are:

1. Language: French or English.
2. Reasons: why the user wants to quit.
3. Risk moments: the times and situations where urges are most likely.
4. First if/then plan: "If this happens, then I will do that."
5. Start point: now, or a date in the past.
6. App lock: Face ID or the platform biometrics, with a passcode fallback.
7. Evening check-in: whether to receive a daily reminder, and at what time.

### Home

The home screen shows:

- the current streak,
- a rank card with the current rank and progress toward the next one,
- a daily quote,
- an emergency button that opens the emergency screen.

During the first 24 hours of a streak, the counter shows hours and minutes. After that, it shows days.

### Ranks

Ranks reward total clean days. A dedicated screen lists all ranks, and a rank unlock screen appears when a new rank is reached. See [Ranks](ranks.md).

### Emergency screen

The emergency screen helps the user get through an urge. It contains:

- an urge surfing timer,
- guided breathing: 4 seconds in, 4 seconds hold, 6 seconds out,
- the user's if/then plan,
- help actions,
- two exits: "I held on" and "I had a lapse".

### Lapse screen

The lapse screen opens when the user logs a lapse. It keeps total clean days and rank, restarts the streak, and offers optional questions. See [Relapse](relapse.md).

### Daily check-in

The check-in records:

- mood, from 1 to 5,
- urge level,
- context chips,
- an optional note.

### Journal

A text journal with writing prompts to help the user start an entry.

### Reasons and plans editor

The user can edit their reasons and their if/then plans at any time after the onboarding.

### Reminders

Optional local reminders, including the evening check-in. Notification text is always neutral and never reveals what the app is about.

### App lock

The app is locked with biometrics, with a passcode fallback.

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

A page about flust and fnyx-group.

## V1.0

Release on the App Store and Google Play under the fnyx-group organization, once the association is registered.
