import { useCanGoBack, useRouter, type Href } from 'expo-router';

// A screen can open without one under it, from a link or a notification at launch: it then goes
// to `fallback`. useCanGoBack reads the screen's own root, unlike router.canGoBack(), which reads
// a reference that the previous root clears when Android recreates the activity.
export function useGoBack(fallback: Href): () => void {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return () => {
    if (canGoBack) router.back();
    else router.replace(fallback);
  };
}
