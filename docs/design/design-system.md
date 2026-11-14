# Design system

This document defines the visual language of flust: colors, typography, layout, navigation and tone. The app uses a single dark theme.

## Colors

| Token          | Value     | Use                                                               |
| -------------- | --------- | ----------------------------------------------------------------- |
| Background     | `#111116` | Screen background                                                 |
| Surface        | `#1A1A21` | Cards                                                             |
| Separator      | `#2A2A33` | Separators                                                        |
| Locked         | `#5C5B66` | Locked ranks and emblems, days before the start in the week strip |
| Secondary text | `#B9B8C2` | Labels and secondary text                                         |
| Text           | `#FFFFFF` | Primary text                                                      |
| Accent         | `#7B6BFF` | See below                                                         |

Text on the accent color is always `#111116`.

The accent is reserved for primary actions, progress, unlocked emblems, the active tab, the clean days of the home week strip and the bar beside the daily quote. It is not used otherwise for decoration.

No gradients. No emojis.

## Typography

Two typefaces, bundled with the app:

- Manrope, weights 400 to 800, for the whole interface.
- Barlow Condensed, weights 500 and 600, for numbers only.

Counters use tabular numbers so digits do not shift as they change.

| Style                             | Size  | Weight | Notes                 |
| --------------------------------- | ----- | ------ | --------------------- |
| Streak counter, 1 or 2-digit days | 226   | 600    | Barlow Condensed      |
| Streak counter, 3-digit days      | 150   | 600    | Barlow Condensed      |
| Streak counter, 4-digit days      | 113   | 600    | Barlow Condensed      |
| Streak counter, 1-digit hours     | 141   | 600    | Barlow Condensed      |
| Streak counter, 2-digit hours     | 105   | 600    | Barlow Condensed      |
| Streak counter unit               | 40    | 600    | Secondary text color  |
| Welcome title                     | 40    | 800    | Onboarding welcome    |
| Brand lockup                      | 36    | 800    | Onboarding welcome    |
| Stepper value                     | 32    | 600    | Barlow Condensed      |
| Screen title                      | 28    | 800    |                       |
| Rank name                         | 22    | 800    |                       |
| Daily quote                       | 19    | 700    | Line height 26        |
| Calendar day                      | 18    | 500    | Barlow Condensed      |
| Select value                      | 17    | 800    | Value of a select row |
| Row                               | 15    | 600    |                       |
| Rank badge name                   | 15    | 800    |                       |
| Primary button                    | 17    | 800    | Text on accent        |
| Secondary button                  | 15    | 600    |                       |
| Body                              | 15-16 | 400    |                       |
| Section label                     | 16    | 600    | Secondary text color  |
| Label                             | 13    | 600    | Secondary text color  |
| Caption                           | 12    | 400    |                       |
| Rank badge detail                 | 12    | 600    | Secondary text color  |
| Weekday initial                   | 11    | 600    | Secondary text color  |

The streak counter is not in a card: it spans the screen width minus the screen padding, 320 points on a 360 point wide screen and 350 on a 390 point one. Its size is the largest that keeps it on one line, units included, at 320 points in both languages. Days use 226 up to 99, 150 up to 999, then 113. Hours have their own sizes, since " h " and " min" take more room than " jours": 141 for "7 h 40 min" and 105 for "12 h 05 min", with minutes always shown on two digits. A test measures the widest counter of each size with the fonts' glyph widths, and checks that one point more would no longer fit. Only screens narrower than 360 points shrink the counter further to fit.

The counter, digits and units together, does not grow with the system text size, since it is already the largest text on screen. Screen readers read it as one sentence, such as "Série en cours : 7 heures 40 minutes". Every other text grows with the system text size.

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
| Touch targets      | At least 44 by 44             |

## Navigation

The tab bar has four tabs: Home, Journal, Ranks and Settings. Tab icons are line icons. The active tab icon uses the accent color.

The emergency screen is not a tab. It is reached from the emergency button on the home screen.

The home header shows the flust symbol with the name next to it. The lock screen shows the same symbol and name, larger and centered.

## Home

From top to bottom, with the screen padding of 20:

1. A header row: the brand lockup on the left, the rank badge on the right.
2. One block, without a card, centered vertically in the free space between the header and the button: the "Série en cours" label, the streak counter, the week strip, then the daily quote. The week strip and the quote are 40 points apart. The free space goes above and below the block, never between its parts.
3. The "J'ai une envie" button at the bottom.

### Rank badge

A pill on the surface color (radius full, padding 4 12 4 4). It holds a 56 point progress ring, with a 3 point stroke, a separator track and accent progress, and the 28 point rank emblem inside. A text column follows: the rank name (15/800) and a secondary line (12/600).

| Moment              | Name         | Secondary line             | Ring                                  |
| ------------------- | ------------ | -------------------------- | ------------------------------------- |
| Before day one      | Premier rang | "Novice dans 16 h 20"      | Current streak toward 24 hours        |
| With a next rank    | Current rank | "Mage blanc dans 2 jours"  | Total clean days toward its threshold |
| After the last rank | Current rank | "Tous les rangs débloqués" | Full                                  |

Before day one, the emblem is the first rank's, in the locked color. The badge opens the ranks tab. Screen readers read it as one button, such as "Sorcier, Mage blanc dans 2 jours".

### Week strip

The last 7 local days, today on the right. Each day is a bar (height 6, radius 3) with its weekday initial under it (11/600, secondary text color). The initials come from the platform's locale data in the app language.

| Day                | Bar                   | Initial        |
| ------------------ | --------------------- | -------------- |
| Clean              | Accent                | Secondary text |
| Today, in progress | Accent at 50% opacity | Secondary text |
| With a lapse       | Separator             | Secondary text |
| Before the start   | None                  | Locked         |

Days before the journey start show no bar, only their initial, so the first week fills up day by day instead of starting with grey bars. A day with a lapse keeps a neutral separator bar: the strip never uses red or crosses. Today turns to the separator color once a lapse is logged. Days change at local midnight, like the daily quote. Screen readers read the strip as one summary, such as "6 jours propres sur les 7 derniers".

### Daily quote

No title. A 3 point accent bar runs along the left of the quote (19/700, line height 26), with the author under it in secondary text when there is one. Screen readers read it as one label starting with "Mot du jour", followed by the author.

## Notifications

Notifications are always neutral and never reveal what the app is about.

## Daily quotes

Daily quotes are either original lines written for flust or lines from public domain authors such as Epictetus, Seneca and Marcus Aurelius. Every quote is available in French and English.

Quotes from living authors are not used without their permission.

## Voice and wording

- Sentences are calm, plain and non-judgmental. They state what happened and what the user can do, without blame, alarm or pressure.
- French addresses the user with "tu".
- French text never assumes the user's gender. Use neutral nouns and phrasings instead of gendered adjectives and participles: "Le stress" rather than "Stressé", "La fatigue" rather than "Fatigué", "La solitude à la maison" rather than "Seul à la maison", "Retrouver l'estime de moi" rather than "Être fier de moi", "Être là pour mes proches" rather than "Être présent pour mes proches".
- French punctuation follows French typography: a narrow no-break space (U+202F) before "?", "!" and ";", and a no-break space (U+00A0) before ":", so the sign never wraps alone onto the next line. A test checks every French string.
- A lapse is "lapse" in English and "écart" in French. The interface never says "relapse" or "rechute".

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
