# 0026 Android splash symbol

## Context

From Android 12, the system draws the splash screen itself: an icon centered in a circle, about two thirds of its size, with anything outside cut off. The wide flust lockup does not fit and was cropped.

## Decision

- On Android, the splash shows the violet symbol alone (`assets/brand/flust-symbol.png`, 1024 px square, 96 dp wide). The PNG is rendered from `flust_symbole_violet.svg`, scaled so every point stays inside the circle.
- iOS keeps the lockup.

## Consequences

- The splash looks the same on Android 12 and later and on older versions, which use the same image.
- A change to the symbol means rendering the PNG again, with the same margins.
