# Design system

This document defines the visual language of flust: colors, typography, layout, navigation and tone. The app uses a single dark theme.

## Colors

| Token          | Value     | Use                       |
| -------------- | --------- | ------------------------- |
| Background     | `#111116` | Screen background         |
| Surface        | `#1A1A21` | Cards                     |
| Separator      | `#2A2A33` | Separators                |
| Locked         | `#5C5B66` | Locked ranks and emblems  |
| Secondary text | `#B9B8C2` | Labels and secondary text |
| Text           | `#FFFFFF` | Primary text              |
| Accent         | `#7B6BFF` | See below                 |

Text on the accent color is always `#111116`.

The accent is reserved for primary actions, progress, unlocked emblems and the active tab. It is not used for decoration.

No gradients. No emojis.

## Typography

Two typefaces, bundled with the app:

- Manrope, weights 400 to 800, for the whole interface.
- Barlow Condensed, weights 500 and 600, for numbers only.

Counters use tabular numbers so digits do not shift as they change.

| Style                              | Size  | Weight | Notes                |
| ---------------------------------- | ----- | ------ | -------------------- |
| Streak counter (days)              | 240   | 600    | Barlow Condensed     |
| Streak counter (hours and minutes) | 176   | 600    | Barlow Condensed     |
| Screen title                       | 28    | 800    |                      |
| Rank name                          | 22    | 800    |                      |
| Row                                | 15    | 600    |                      |
| Primary button                     | 17    | 800    | Text on accent       |
| Secondary button                   | 15    | 600    |                      |
| Body                               | 15-16 | 400    |                      |
| Label                              | 13    | 600    | Secondary text color |
| Caption                            | 12    | 400    |                      |

The streak counter shrinks when it reaches 3 and 4 digits so it fits on one line.

## Layout

| Element            | Value                         |
| ------------------ | ----------------------------- |
| Screen padding     | 20                            |
| Top padding        | 60                            |
| Cards              | Radius 20 to 22               |
| Primary button     | Height 58, radius 18          |
| Secondary button   | Height 48 to 50, radius 16    |
| Chips              | Pill shape                    |
| Segmented controls | Radius 16, segments radius 12 |
| Switches           | 48 by 28                      |

## Navigation

The tab bar has four tabs: Home, Journal, Ranks and Settings. Tab icons are line icons. The active tab icon uses the accent color.

The emergency screen is not a tab. It is reached from the emergency button on the home screen.

The home header shows the flust symbol with the name next to it. The lock screen shows the same symbol and name, larger and centered.

## Notifications

Notifications are always neutral and never reveal what the app is about.

## Daily quotes

Daily quotes are either original lines written for flust or lines from public domain authors such as Epictetus, Seneca and Marcus Aurelius. Every quote is available in French and English.

Quotes from living authors are not used without their permission.

## Screens

### Design system

![Design system](screens/design-system.png)

### Onboarding

![Onboarding, step 1](screens/onboarding-1.png)

![Onboarding, step 2](screens/onboarding-2.png)

![Onboarding, step 3](screens/onboarding-3.png)

![Onboarding, step 4](screens/onboarding-4.png)

![Onboarding, step 5](screens/onboarding-5.png)

### Home, first day

![Home, first day](screens/home-first-day.png)

### Home

![Home](screens/home.png)

### Ranks

![Ranks](screens/ranks.png)

### Rank unlocked

![Rank unlocked](screens/rank-unlocked.png)

### Emergency

![Emergency](screens/emergency.png)

### Check-in

![Check-in](screens/check-in.png)

### Relapse

![Relapse](screens/relapse.png)

### Journal

![Journal](screens/journal.png)

### Note

![Note](screens/note.png)

### Reasons and plans

![Reasons and plans](screens/reasons-and-plans.png)

### Reminders

![Reminders](screens/reminders.png)

### Settings

![Settings](screens/settings.png)

### Lock

![Lock](screens/lock.png)
