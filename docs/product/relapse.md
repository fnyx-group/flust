# Relapse

This document describes how flust responds when the user logs a lapse.

## Background

The design is based on the abstinence violation effect described by Marlatt. After breaking a rule of abstinence, people tend to see the lapse as proof of personal failure ("I have ruined everything"), which makes further use more likely. The goal of flust is to stop a single lapse from turning into a spiral.

## In the moment

The lapse screen opens from the emergency screen ("I had a lapse") or from the discreet "I had a lapse" text button under the home button. It:

- shows the message "A lapse, not a reset",
- shows the total clean days kept and the streak that just ended, and that the rank is kept,
- restarts the streak, which shows hours and minutes again,
- asks optional questions: where it happened (bedroom, bathroom, living room, work, transport, elsewhere), when (now by default, or earlier within the streak that just ended, at least a minute after the last lapse or the start), and the context (the risk moment presets),
- offers to adjust the if/then plan, prefilled with the current plan.

Every step can be skipped. "Save and start again" and "Skip" both log the lapse; "Skip" stores no place, context or plan change; it keeps an earlier time if one was chosen, and logs the lapse now otherwise. Going back logs nothing. If the user closes the app during or after the lapse screen, no follow-up alert is sent.

## The following hours

- For six hours after the lapse is logged, one short supportive line shows above the emergency button: "The next few hours matter. You've already done the hardest part by noting it."
- No rank unlock screen appears during those hours. A rank reached meanwhile shows on the badge at once and is announced when they end.
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
- A lapse logged by mistake can be undone from the "Lapse noted · Undo" line on the home screen, until local midnight and never less than an hour after it was logged. The previous streak, the answers and the plan are restored. See [0016](../decisions/0016-lapse-records-and-urge-events.md).

## Related documents

- [Ranks](ranks.md): why the rank is never lowered.
- [Scenarios](scenarios.md): edge cases around lapses and dates.
- [0004 Relapse model](../decisions/0004-relapse-model.md): the decision behind this behavior.
