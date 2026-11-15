import { useNavigation } from 'expo-router';

// A second tap before a pushed screen appears would push it a second time. The navigation state
// changes as soon as the first push is dispatched, so by the second tap this screen has lost
// focus and the action is skipped.
export function useWhenFocused(): (action: () => void) => void {
  const navigation = useNavigation();
  return (action) => {
    if (navigation.isFocused()) action();
  };
}
