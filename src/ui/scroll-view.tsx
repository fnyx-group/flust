import {
  ScrollView as NativeScrollView,
  SectionList as NativeSectionList,
  type ScrollViewProps,
  type SectionListProps,
} from 'react-native';

// Android 12 and later stretch the content at the ends of a scroll, which does not fit the
// design. overScrollMode only applies to Android, so iOS keeps its bounce.
export function ScrollView(props: Omit<ScrollViewProps, 'overScrollMode'>) {
  return <NativeScrollView {...props} overScrollMode="never" />;
}

// A virtualized list in sections, for lists that can grow to hundreds of rows.
export function SectionList<Item, Section>(
  props: Omit<SectionListProps<Item, Section>, 'overScrollMode'>,
) {
  return <NativeSectionList {...props} overScrollMode="never" />;
}
