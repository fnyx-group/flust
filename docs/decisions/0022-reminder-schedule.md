# 0022 Reminder schedule

## Context

Nothing runs in the background to decide whether to remind someone today ([0021](0021-local-notifications.md)). Reminders must therefore be planned in advance, and must stop on their own when the app is no longer opened, so flust never nags someone who stepped away ([Vision](../product/vision.md)).

## Decision

- `planReminders` (`src/domain/reminders.ts`) plans every reminder until a return message seven days ahead, and is called again whenever the app comes to the foreground or what reminders depend on changes. The plan replaces the previous one as a whole.
- Spacing, in local days:
  - The check-in counts from the last check-in, or from the day before the reminder was turned on: days 1, 2, 3, 5 and 7, skipping days that already have one.
  - The thought and the evening risk moment count from today: days 0, 1, 2 and 4.
  - The weekend risk moment comes once, on the next Saturday.
  - Risk times are fixed: 22:30 for "in bed at night", Saturday 10:00 for "the weekend". Other risk moments have no time and give no reminder.
- At most two routine reminders a day, two hours apart, then one a day from the third day. The check-in wins, then risk hours, then the thought.
- The rank reminder is planned for when the next rank is reached (`nextRankAt`), held for six hours after a lapse is logged, and moved into 09:00 to 22:00. It keeps its instant across a time zone change, unlike the others, which keep their wall time.
- The return message, "flust is here whenever you like, no pressure", is the last notification, at the check-in time or 19:00. Nothing follows it.
- There is no reminder after a lapse.
- Texts are neutral and never say what flust is about. A tap opens the check-in for its reminder, and home for the others.

## Consequences

- Someone who stops opening the app gets at most a week of reminders, thinning out, then one last message, then silence.
- Each open plans again from that day, so regular use keeps the full rhythm.
- A wall time skipped by a clock change moves forward by the gap, as in [0013](0013-local-time-to-utc.md).
