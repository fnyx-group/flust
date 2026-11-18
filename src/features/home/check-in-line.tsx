import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { todaysCheckIn } from '@/domain/check-in';
import { localDayNumber } from '@/domain/local-time';
import { useClock } from '@/features/clock/clock-context';
import { useSession } from '@/features/session/session-context';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { PencilIcon } from '@/ui/icons/pencil-icon';
import { colors, pressedOpacity, sizes, spacing, typography } from '@/ui/theme';

// One centered line just above the urge button, which opens the check-in. It follows the local
// day, so it waits again after midnight. Plain secondary text: a missed check-in is never shown as a failure.
export function CheckInLine() {
  const { t } = useTranslation();
  const { checkIns } = useSession();
  const today = useClock((now) => localDayNumber(now, deviceOffsetAt));
  const done = todaysCheckIn(checkIns, today) !== null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={done ? t('home.checkIn.done') : t('home.checkIn.todo')}
      accessibilityHint={t('home.checkIn.hint')}
      onPress={() => router.push('/check-in')}
      style={({ pressed }) => [styles.line, pressed && styles.pressed]}
    >
      <PencilIcon color={colors.gold} size={20} />
      <Text style={styles.text}>{done ? t('home.checkIn.done') : t('home.checkIn.todo')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.m,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  text: {
    ...typography.bodyLarge,
    flexShrink: 1,
    color: colors.textSecondary,
  },
});
