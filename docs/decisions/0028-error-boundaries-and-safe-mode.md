# 0028 Error boundaries and safe mode

## Context

flust has no crash reporter ([0006](0006-no-network-access.md)). A rendering error that nothing catches leaves a blank or frozen app, and a crash during startup can repeat on every launch, with no way for the person to reach the settings, erase their data or report the problem. Screens must never show values from a state that broke, and the tone must stay calm.

## Decision

- Every route file exports an `ErrorBoundary`, Expo Router's per-route boundary: `ScreenErrorBoundary` from `src/features/errors/screen-error-boundary.tsx`, or `RetryOnlyErrorBoundary` for the onboarding, which has no home behind it. A failing screen leaves the tab bar, the other screens and the lock cover working. A test fails when a route lacks one.
- The fallback shows static text only: a title, one sentence saying the data has not been changed, "Try again" and, except on home and the onboarding, "Back to home". It receives nothing from the tree that failed. No red, no animation.
- The root layout exports `RootErrorBoundary`, which catches errors in the gates (storage, lock, session). It sits above the providers, so it brings its own translations and reads no storage or session. It offers "Try again", which mounts the layout again.
- Expo Router's boundary only renders the fallback, so each fallback records the error it shows in the error log ([0029](0029-local-error-log.md)) when it mounts, under the screen that failed: the boundary takes its route from React Navigation's `useRoute()`, which names the screen it renders in, even when another screen has the focus, rather than from the focused route, which is global. A fallback left mounted in another tab or lower in the stack never records again when the person moves on. The route name is the file's pattern, so a parameter reads `[id]`, never its value. An error object is recorded once, whoever reports it. Errors outside rendering go through React Native's global handler, installed once even when Fast Refresh runs the root layout again, and, in release builds, the Hermes promise rejection tracker.
- `LaunchGate`, above `StorageGate`, counts launches in a plain file, `launch-attempts`, before storage opens. The first screen to show resets it, whichever gate draws it: home or onboarding (`SessionGate`), the lock screen (`LockGate`), or a retry, reset or erase failure screen (`StorageGate`). That screen also hides the splash screen.
- After two launches in a row that never reached a first screen, the next one opens safe mode. Trying again from the root boundary mounts `LaunchGate` again and counts as a launch, so an error that repeats during startup leads there too. A counter that cannot be read counts as zero, and one that cannot be removed is set to zero, so the counter itself can never trap the app in safe mode.
- Safe mode opens neither storage nor the session and shows no data. It offers "Try again", which starts normally without counting a launch, so a new failure brings safe mode back; the error report, shown in full before the share sheet opens; and "Erase everything", the same two steps and erase flow as the settings, without opening storage.
- Safe mode sits outside the lock: the lock settings live in the database that may be what fails, the screen shows no data, erasing takes two confirmations, and uninstalling the app erases the same data.
- The error report is the exception: its times show when flust was used, and anyone holding the phone can reach safe mode by closing flust twice during the splash screen. In safe mode, viewing it, and so sharing it, first asks for the device's own authentication through `src/features/lock/local-auth.ts`, with the same rule as the lock: a device state that cannot be read asks, and only a read that confirms there is no screen lock opens the report without asking. Erasing stays reachable without it.

## Consequences

- A broken screen no longer takes the app down, and a crash loop at startup always ends on a screen that can report it or erase everything.
- A person who force-closes the app twice during the splash screen gets safe mode once. This is accepted, and it is also how safe mode is checked by hand. Someone else doing it reaches only "Try again", which goes through the lock, the report behind the device's authentication, and erasing.
- A crash in native code is not logged, since flust has no native crash handler. It still counts toward safe mode when it happens during startup.
- A screen that fails on every render keeps showing its fallback; the other tabs, About and its error report stay reachable.
- The launch counter is not encrypted. It holds one number and nothing else.
