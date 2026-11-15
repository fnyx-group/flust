import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { ScrollView } from '@/ui/scroll-view';
import { colors, radii, typography } from '@/ui/theme';

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PADDING_ROWS = (VISIBLE_ROWS - 1) / 2;
// Opacity by distance from the middle band: the rows above and below fade out.
const FADE = [1, 0.5, 0.2];
// A drag released without momentum still snaps; the row is read once that snap is over.
const SNAP_SETTLE_MS = 250;

type WheelProps = {
  rows: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  // What the wheel sets, read by screen readers with the selected row as its value.
  label: string;
  // Moves without animation, for Reduce Motion.
  reduceMotion: boolean;
  width: number;
};

function indexAt(offset: number, rowCount: number): number {
  return Math.min(Math.max(Math.round(offset / ROW_HEIGHT), 0), rowCount - 1);
}

// A column of rows that snaps to one row, with momentum. The selected row sits in a band in the
// middle. For assistive technologies it is one adjustable element, moved row by row.
export function Wheel({ rows, selectedIndex, onChange, label, reduceMotion, width }: WheelProps) {
  const scroll = useRef<ScrollViewInstance>(null);
  const latestOffset = useRef(selectedIndex * ROW_HEIGHT);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offset, setOffset] = useState(selectedIndex * ROW_HEIGHT);
  const centered = indexAt(offset, rows.length);

  // Follows the selection when it changes from outside the scroll, such as an accessibility
  // action, and places the wheel on its row when it first shows.
  useEffect(() => {
    const target = selectedIndex * ROW_HEIGHT;
    scroll.current?.scrollTo({ y: target, animated: !reduceMotion });
  }, [selectedIndex, reduceMotion]);

  useEffect(() => () => cancelSettle(), []);

  function cancelSettle() {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  }

  function settleAt(position: number) {
    cancelSettle();
    const index = indexAt(position, rows.length);
    if (index !== selectedIndex) onChange(index);
  }

  function track(event: NativeSyntheticEvent<NativeScrollEvent>) {
    latestOffset.current = event.nativeEvent.contentOffset.y;
    setOffset(event.nativeEvent.contentOffset.y);
  }

  function adjust(event: AccessibilityActionEvent) {
    const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
    const index = Math.min(Math.max(selectedIndex + step, 0), rows.length - 1);
    if (index !== selectedIndex) onChange(index);
  }

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: rows[selectedIndex] ?? '' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={adjust}
      style={[styles.wheel, { width }]}
    >
      <View pointerEvents="none" style={styles.band} />
      <ScrollView
        ref={scroll}
        contentOffset={{ x: 0, y: selectedIndex * ROW_HEIGHT }}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={track}
        onScrollEndDrag={() => {
          cancelSettle();
          settleTimer.current = setTimeout(() => settleAt(latestOffset.current), SNAP_SETTLE_MS);
        }}
        onMomentumScrollBegin={cancelSettle}
        onMomentumScrollEnd={(event) => settleAt(event.nativeEvent.contentOffset.y)}
        contentContainerStyle={styles.content}
      >
        {rows.map((row, index) => {
          const distance = Math.abs(index - offset / ROW_HEIGHT);
          const fade = FADE[Math.min(Math.round(distance), FADE.length - 1)] ?? 0;
          const selected = index === centered;
          return (
            <View key={row} style={styles.row}>
              <Text style={[selected ? styles.selected : styles.other, { opacity: fade }]}>
                {row}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: {
    height: ROW_HEIGHT * VISIBLE_ROWS,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ROW_HEIGHT * PADDING_ROWS,
    height: ROW_HEIGHT,
    borderRadius: radii.segment,
    backgroundColor: colors.surface,
  },
  content: {
    paddingVertical: ROW_HEIGHT * PADDING_ROWS,
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    ...typography.wheelSelected,
    color: colors.text,
  },
  other: {
    ...typography.wheelRow,
    color: colors.textSecondary,
  },
});
