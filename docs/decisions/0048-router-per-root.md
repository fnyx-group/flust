# 0048 Router of each root instead of the global router

## Context

A field build crashed on a Xiaomi Poco F4 when the person tapped the streak counter: `Error: The imperative router is unavailable before the first render has finished.`, thrown from `router.navigate('/ranks')`. The same crash came back on the emulator by changing the font size while flust was open, then tapping the counter.

expo-router exports a global `router`. Each navigation container binds it to its own routing queue when it mounts, and on unmount puts back a version that throws, whether or not another container is mounted. `fontScale` and `densityDpi` are not in the activity's `configChanges`, so Android recreates the activity when the font size or the display size changes. The new React root mounts before the old one unmounts, and from then on every call to the global router throws: a tap on the counter, a notification tap, the held navigation after the unlock, the rank unlock screen.

`useRouter()` enqueues into the routing queue of the root it is rendered in, which never depends on another root.

## Decision

- flust navigates only with `useRouter()`. Code outside a component receives the router from the component that calls it.
- Back buttons go through `useGoBack(fallback)`, which reads `useCanGoBack()`. The navigation reference behind `router.canGoBack()` is shared by every root, and the old root sets it to null as it unmounts, so after a recreation it would always answer that there is nothing to go back to.
- ESLint refuses `import { router } from 'expo-router'` in every layer.
- `src/features/home/streak-counter.test.tsx` mounts two roots, unmounts the first and taps the counter in the second, which threw with the global router.
- The activity keeps being recreated on a font or display size change, as Android does by default: handling those changes in place would leave React Native's text and layout sizes to update by themselves, which it does not promise.

## Consequences

- Hooks that navigate from an effect list the router among their dependencies. Its identity changes only when the root's transition mode changes, which flust never does.
- `@testing-library/react-native` is a development dependency, for `expo-router/testing-library`.
