import { router } from 'expo-router';

// The note screen can open without a screen under it, from a link at launch. It then goes to the
// journal, where going back would have nowhere to go.
export function closeNote() {
  if (router.canGoBack()) router.back();
  else router.replace('/journal');
}
