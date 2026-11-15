# 0023 App lock

## Context

flust holds intimate data. Storage is encrypted at rest ([0011](0011-encrypted-sqlite-storage.md)), but anyone holding the unlocked phone could open the app. An optional lock is expected. It must never lock the person out of their own data.

## Decision

- The lock uses the device's own authentication through `expo-local-authentication`: biometrics with the device passcode as fallback. flust has no passcode of its own, so there is nothing to forget or reset.
- It is a UI gate, not a key: the storage key stays in the keystore without biometric binding. Losing biometrics, or changing them, never makes data unreadable.
- `LockGate` sits between `StorageGate` and `SessionGate`. At a locked launch only the lock screen renders: no route mounts and the session is not loaded.
- After launch, leaving the app covers it at once, and coming back locks it once the chosen delay has passed. The delay can be immediately, 1, 5 or 15 minutes, or 1 hour, and defaults to 1 minute. Time away is the longer of the monotonic and the wall clock gaps.
- Screens shown over the others are cards, not native modals, because a native modal would sit above the cover. Sheets close while locked and come back after.
- Links and notification taps that arrive while locked are held and replayed on unlock (`+native-intent.tsx`, `held-navigation.ts`).
- System screens flust opens itself, such as the passcode prompt or the notification permission, get a one-minute grace, so the app does not lock right after them.
- When the device no longer has a screen lock, the lock is paused rather than kept or dropped. The setting stays on and works again once a screen lock is set.
- Turning the lock on or off asks the device first. A stored value that cannot be read keeps the lock on.
- The lock screen offers "Unlock" when biometrics are enrolled, and "Enter passcode" as the main button otherwise.

## Consequences

- Anyone who knows the device passcode can open flust, as with any app protected this way.
- Removing the device's screen lock opens flust. Doing so already requires the device passcode.
- Data stays readable after biometric changes, a new fingerprint or a reset of Face ID.
