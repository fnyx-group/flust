// The Android back button on a question step never leaves the onboarding: it goes to the
// previous step, or does nothing while the answers are being saved. The welcome step has no
// handler, so there it leaves the app as usual.
export function handleBackPress(onBack: () => void, disabled: boolean): true {
  if (!disabled) onBack();
  return true;
}
