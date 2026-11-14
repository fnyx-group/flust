import { ScrollView as NativeScrollView, type ScrollViewProps } from 'react-native';

// Android 12 and later stretch the content at the ends of a scroll, which does not fit the
// design. overScrollMode only applies to Android, so iOS keeps its bounce.
export function ScrollView(props: Omit<ScrollViewProps, 'overScrollMode'>) {
  return <NativeScrollView {...props} overScrollMode="never" />;
}
