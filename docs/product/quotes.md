# Quotes

The home screen shows one quote a day. Quotes are either original lines written for flust or lines from Epictetus, Seneca and Marcus Aurelius, in flust's own translation from the Greek and Latin texts, never copied from a published modern translation. Nothing comes from living authors ([Design system](../design/design-system.md#daily-quotes)).

## Rules

- The quote changes at local midnight and stays the same all day.
- Days are counted from the local day the journey started: the first day shows quote 1, and all 30 are shown before one repeats.
- There are 18 ancient lines and 12 original ones. The order follows the pattern ancient, original, ancient, ancient, original, so two original lines never follow each other and ancient lines never come more than two in a row. The ancient authors take turns.
- The author is shown for the ancient lines. Original lines show no author.
- French renderings follow the voice rules: they address the reader with "tu" and never assume their gender.

## List

| #   | English                                                                                                                         | Source                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | Nothing great comes into being all at once.                                                                                     | Epictetus, _Discourses_ 1.15.7       |
| 2   | An urge is a wave. It rises, peaks and passes.                                                                                  | Original                             |
| 3   | Claim yourself back.                                                                                                            | Seneca, _Letters to Lucilius_ 1.1    |
| 4   | Be like the headland the waves keep breaking on: it stands firm, and around it the churning water grows calm.                   | Marcus Aurelius, _Meditations_ 4.49  |
| 5   | A lapse is a moment, not a verdict.                                                                                             | Original                             |
| 6   | Wait for me a little, impression. Let me see what you are and what you are about.                                               | Epictetus, _Discourses_ 2.18.24      |
| 7   | What you do instead matters more than what you resist.                                                                          | Original                             |
| 8   | More things frighten us than crush us, and we suffer more often in imagination than in reality.                                 | Seneca, _Letters to Lucilius_ 13.4   |
| 9   | Do not let the thought of your whole life unsettle you.                                                                         | Marcus Aurelius, _Meditations_ 8.36  |
| 10  | You don't have to settle everything today. Only the next hour.                                                                  | Original                             |
| 11  | How long will you wait before you demand the best of yourself?                                                                  | Epictetus, _Enchiridion_ 51          |
| 12  | Notice the urge. Name it. Let it go by.                                                                                         | Original                             |
| 13  | No wind is favorable to someone who does not know which port they are making for.                                               | Seneca, _Letters to Lucilius_ 71.3   |
| 14  | Your mind takes on the color of the images you often dwell on, for the soul is dyed by its thoughts.                            | Marcus Aurelius, _Meditations_ 5.16  |
| 15  | Every clean day is yours to keep.                                                                                               | Original                             |
| 16  | If you want something to become a habit, do it. If you want to stop, don't do it, and get used to doing something else instead. | Epictetus, _Discourses_ 2.18.4       |
| 17  | Tiredness, stress and boredom ask for rest, not for an escape.                                                                  | Original                             |
| 18  | It is your mind you must change, not your sky.                                                                                  | Seneca, _Letters to Lucilius_ 28.1   |
| 19  | Dig within. Within is the spring of good, and it can always well up if you keep digging.                                        | Marcus Aurelius, _Meditations_ 7.59  |
| 20  | Freedom is built quietly, one choice after another.                                                                             | Original                             |
| 21  | It is not things that disturb us, but our judgments about them.                                                                 | Epictetus, _Enchiridion_ 5           |
| 22  | Your attention is precious. Give it to what you love.                                                                           | Original                             |
| 23  | While we put things off, life runs past.                                                                                        | Seneca, _Letters to Lucilius_ 1      |
| 24  | Stop arguing about what a good person should be. Be one.                                                                        | Marcus Aurelius, _Meditations_ 10.16 |
| 25  | Progress is not a straight line, and it still counts.                                                                           | Original                             |
| 26  | Some things are up to us, and some are not.                                                                                     | Epictetus, _Enchiridion_ 1.1         |
| 27  | Ten minutes of breathing can change the whole evening.                                                                          | Original                             |
| 28  | If you want to bring everything under your rule, put yourself under the rule of reason.                                         | Seneca, _Letters to Lucilius_ 37.4   |
| 29  | Nowhere can you withdraw to a place more peaceful or more free of trouble than your own soul.                                   | Marcus Aurelius, _Meditations_ 4.3   |
| 30  | Remember why you started.                                                                                                       | Original                             |

The French text of each quote is in `src/lib/i18n/locales/fr.json`, and the order in `src/domain/quotes.ts`.

## Time zones

Days follow the device's current time zone, which has two consequences:

- After the user moves to another time zone, the start of the journey can fall on a different local day. The count of days then shifts by one, so a quote is shown a second day in a row or one is skipped.
- In time zones that set the clock back at midnight, such as America/Santiago, the hour from 23:00 to midnight is lived twice. The quote changes at the first midnight, shows the previous day's quote again during the repeated hour, and changes back at the second midnight.

Both are rare and harmless, so the app accepts them rather than storing the local day the journey started.

## Translation notes

- 23: the paragraph numbering of Letter 1 differs between editions, so only the letter is cited.
- 24: the Greek says "good man"; "good person" and "personne de bien" keep the sense without assuming a gender.
