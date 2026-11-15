import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  StyleSheet,
  type ScrollViewInstance,
  type StyleProp,
  type TextInputSelectionChangeEvent,
  type ViewStyle,
} from 'react-native';

import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';

type KeyboardScreenProps = {
  header: ReactNode;
  // The scrolling content.
  children: ReactNode;
  // What stays visible above the keyboard, under the content.
  footer?: ReactNode;
  // Sheets and other modals, outside the area the keyboard resizes.
  overlay?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollRef?: RefObject<ScrollViewInstance | null>;
};

// A full screen whose content scrolls between a fixed header and a footer that rises with the
// keyboard. Android draws edge to edge, so the window no longer shrinks under the keyboard and
// both platforms need the padding.
export function KeyboardScreen({
  header,
  children,
  footer,
  overlay,
  contentContainerStyle,
  scrollRef,
}: KeyboardScreenProps) {
  return (
    <Screen bottomInset>
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        {header}
        <ScrollView
          ref={scrollRef}
          style={styles.fill}
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
      {overlay}
    </Screen>
  );
}

type FollowEndHandlers = {
  onFocus: () => void;
  onBlur: () => void;
  onSelectionChange: (event: TextInputSelectionChangeEvent) => void;
  onContentSizeChange: () => void;
};

// A multiline field that grows with its text, inside a KeyboardScreen, would let the cursor sink
// under the keyboard as the user writes at its end: neither platform scrolls the parent for it.
// While the cursor is at the end of the field, the content follows it to the bottom, as the field
// grows and when the keyboard opens. The field ends the content, apart from a few short lines.
export function useFollowTextEnd(
  scrollRef: RefObject<ScrollViewInstance | null>,
  value: string,
): FollowEndHandlers {
  const focused = useRef(false);
  const atEnd = useRef(false);
  const length = useRef(value.length);

  useEffect(() => {
    length.current = value.length;
  }, [value]);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      if (focused.current && atEnd.current) scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => subscription.remove();
  }, [scrollRef]);

  return {
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
    },
    // The selection can arrive before the new text, so an end at or past the known length counts.
    onSelectionChange: (event) => {
      atEnd.current = event.nativeEvent.selection.end >= length.current;
    },
    onContentSizeChange: () => {
      if (focused.current && atEnd.current) scrollRef.current?.scrollToEnd({ animated: false });
    },
  };
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
