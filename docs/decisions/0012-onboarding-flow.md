# 0012 Onboarding flow

## Context

The onboarding runs once, before anything else. It must resume at the same step with its answers after the app is killed, let the user go back on every step, give defaults to skipped steps, and end with the user's reasons, risk moments and first plan stored as real data that the emergency screen and the reasons and plans editor will read. The app must never show the tabs without a journey, nor the onboarding once a journey exists.

## Decision

- Whether the onboarding is finished is not a flag: it is finished when a journey exists. `SessionGate` loads the journey and the chosen language before the splash screen hides, and the root stack uses `Stack.Protected`: the tabs and the emergency screen need a journey, the onboarding route needs none. Setting the journey after the onboarding makes the router move to the home tab.
- The onboarding is a single route, `src/app/onboarding.tsx`. The current step is stored in the draft and is the only navigation state, so a relaunch resumes on it and the back button and the Android back button go to the previous step whatever was shown before in the session. The iOS swipe-back gesture does not move between steps.
- The draft is one row of `onboarding_draft`: the step, and the answers as JSON. Every change is written at once. Answers are validated when read, and anything unreadable falls back to its default instead of blocking the onboarding.
- Finishing writes the journey, the reasons, the risk moments and the plan to their own tables (`reason`, `risk_moment`, `plan`) and deletes the draft in one transaction. If any write fails, nothing changes and the onboarding stays on the last step with its answers.
- Predefined reasons, risk moments, triggers and actions are stored as stable ids (`src/domain/presets.ts`) translated on display. Text the user writes is stored as text. Each row holds one or the other, enforced by a `CHECK` constraint.
- Continue is always enabled. A step left empty keeps its default: no reasons, no risk moments, the plan "when an urge hits, start the guided breathing", and a start now. A plan whose risk moment was unselected afterwards falls back to "when an urge hits".
- The chosen language is a setting, saved only when the user picks one. Without one, the device language applies.

## Consequences

- There is no state in which the onboarding is marked done without a journey, or the reverse.
- An installed database at schema 1 that already has a journey skips the onboarding after migrating.
- A journey that decrypts but fails validation offers the same two-step reset as an unreadable database, since a retry would read the same data. `SessionGate` reports it to `StorageGate`, which closes storage first. A storage error while loading the journey only offers a retry.
- The reasons and plans editor will read and write the same tables; the onboarding offers one custom reason and one plan, the tables allow more.
- Ids in `presets.ts` are stored on devices and are never renamed once released.
