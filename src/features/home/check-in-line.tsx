import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { todaysCheckIn } from '@/domain/check-in';
import { localDayNumber } from '@/domain/local-time';
import { useClock } from '@/features/clock/clock-context';
import { useSession } from '@/features/session/session-context';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { colors, pressedOpacity, sizes, typography } from '@/ui/theme';

// One line under the quote, which opens the check-in. It follows the local day, so it reads "to
// do" again after midnight. Plain secondary text: a missed check-in is never shown as a failure.
export function CheckInLine() {
  const { t } = useTranslation();
  const { checkIns } = useSession();
  const today = useClock((now) => localDayNumber(now, deviceOffsetAt));
  const done = todaysCheckIn(checkIns, today) !== null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={done ? t('home.checkIn.done') : t('home.checkIn.todoSpoken')}
      accessibilityHint={t('home.checkIn.hint')}
      onPress={() => router.push('/check-in')}
      style={({ pressed }) => [styles.line, pressed && styles.pressed]}
    >
      <Text style={styles.text}>{done ? t('home.checkIn.done') : t('home.checkIn.todo')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: {
    minHeight: sizes.touchTarget,
    justifyContent: 'center',
  },
  pressed: {
    opacity: pressedOpacity,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
