# 0027 Offline help resources

## Context

The emergency screen helps with urges, not with dark thoughts, and the low mood card could only name "the emergency number where you are" ([0018](0018-daily-check-in.md)). People need a crisis line and the emergency numbers of their country, available at any time, without flust going online ([0006](0006-no-network-access.md)). A wrong or outdated number is worse than none, and many French-speaking users live outside France.

## Decision

- A small list is bundled in `src/domain/help-resources.ts`: France (3114, 15, 112, and 114 by text message), Belgium (0800 32 123, 1813, 112, 101), Switzerland (La Main Tendue 143, 144, 117, 112), Canada (988 by call or text, 911), the United States (988 by call or text, 911), the United Kingdom (Samaritans 116 123, 999, 112) and Ireland (Samaritans 116 123, 112, 999). Any other region gets 112 and a link to findahelpline.com. In the European Union, 112 is named as the official number. Elsewhere, the screen says to dial the local number if 112 does not connect.
- A country is listed only when every one of its numbers is confirmed by an official page.
- Each entry keeps the official page that states it and the day it was checked. A unit test fails once a check is older than 400 days, so the list is reviewed every year.
- The list follows the device region (`regionCode` from `expo-localization`), not the language: a French speaker in Canada sees the Canadian numbers, in French. The French overseas departments use the French numbers, since 3114.fr says it answers in mainland France and overseas. A "Country" row shows another country's numbers. The choice is not stored.
- Calls and texts open the phone's own apps through `Linking.openURL` with `tel:` and `sms:`. There is no `canOpenURL`, no `LSApplicationQueriesSchemes`, no package visibility query and no `CALL_PHONE` permission: the phone app opens with the number filled in, and nothing is dialed without the person. A failure shows the number to dial by hand.
- The findahelpline.com link carries no country or other parameter, and opens outside flust like the About links.
- Help is reached from a settings row, from a line at the bottom of the emergency screen and from the low mood card. Not from the lapse screen: a lapse is not a crisis. Opening help is never recorded.
- From the emergency screen, help opens over it, so the visit and the countdown keep running underneath.
- Returning from a call follows the chosen lock delay. The phone app is not a system screen flust shows for itself, so it gets no grace.

## Consequences

- The help numbers work offline and reveal nothing to anyone.
- CI fails 400 days after a check, even without a code change, until the entries are checked again. This is intended.
- Numbers only change with a store release.
- The device region can be missing or differ from where the person is. The fallback and the country row cover both.
- The last consequence of [0018](0018-daily-check-in.md), a card without country-specific numbers, no longer holds: the card opens the help screen.
- The full list by country stays planned for V0.4.
