# Relapse

This document describes how flust responds when the user logs a lapse.

## Background

The design is based on the abstinence violation effect described by Marlatt. After breaking a rule of abstinence, people tend to see the lapse as proof of personal failure ("I have ruined everything"), which makes further use more likely. The goal of flust is to stop a single lapse from turning into a spiral.

## In the moment

When the user logs a lapse, the lapse screen:

- shows the message "A lapse, not a reset",
- shows that total clean days and the rank are kept,
- restarts the streak, which shows hours and minutes again,
- asks optional questions: where it happened, when, and how the user felt,
- offers to adjust the if/then plan.

Every step can be skipped. If the user closes the app during or after the lapse screen, no follow-up alert is sent.

## The following hours

- The emergency button is highlighted on the home screen, with a short supportive line.
- If reminders are on, the app sends at most one gentle reminder. Its text is neutral, like every notification.

## The next days

The check-in does not mention the lapse.

## Over time

The app detects patterns from lapses and check-ins, such as the time of day and recurring contexts. It shows them in plain words, for example "Your lapses often happen late in the evening", and suggests a targeted plan or reminder.

Pattern detection is computed on the device only. Nothing is sent anywhere.

## Never

- A big reset animation.
- Red color.
- Rank loss.
- A disappointed tone.
- Guilt notifications.
- Crosses on a calendar.
- A comparison with the record streak right after a lapse.

## Special cases

- Frequent lapses over a long period lead to a gentle suggestion to talk to someone, with a link to the help page.
- Several very low mood check-ins in a row show help and crisis resources.
- The app never reads the journal. Pattern detection and suggestions use lapses and check-ins only.
- A lapse logged by mistake can be undone. The previous streak is restored.

## Related documents

- [Ranks](ranks.md): why the rank is never lowered.
- [Scenarios](scenarios.md): edge cases around lapses and dates.
- [0004 Relapse model](../decisions/0004-relapse-model.md): the decision behind this behavior.
