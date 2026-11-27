import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { showLowMoodCard } from '@/domain/check-in';
import { localDayNumber } from '@/domain/local-time';
import { useClock } from '@/features/clock/clock-context';
import { useWhenFocused } from '@/features/shared/use-when-focused';
import { useSession } from '@/features/session/session-context';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { useStorage } from '@/features/storage/storage-context';
import { IconButton } from '@/ui/icon-button';
import { CloseIcon } from '@/ui/icons/close-icon';
import { colors, pressedOpacity, radii, sizes, spacing, typography } from '@/ui/theme';

// A calm card after several low mood check-ins: no red, no accent, no animation. It suggests
// talking to someone, names the emergency number without a country, which holds wherever the
// person is, and opens the help numbers. Closing it hides it until the next local day.
export function LowMoodCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const storage = useStorage();
  const { checkIns, lowMoodDismissedDay, dismissLowMood } = useSession();
  const today = useClock((now) => localDayNumber(now, deviceOffsetAt));
  const whenFocused = useWhenFocused();
  if (!showLowMoodCard(checkIns, today, lowMoodDismissedDay)) return null;

  // The card closes at once even if the day cannot be stored: an error about closing a message
  // would weigh more than seeing it again after a relaunch.
  function dismiss() {
    dismissLowMood(today);
    void storage.settings.saveLowMoodDismissedDay(today);
  }

  return (
    <View style={styles.card}>
      <View style={styles.texts}>
        <Text style={styles.text}>{t('home.lowMood.text')}</Text>
        <Text style={styles.emergency}>{t('home.lowMood.emergency')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => whenFocused(() => router.push('/help'))}
          style={({ pressed }) => [styles.help, pressed && styles.pressed]}
        >
          <Text style={styles.helpLabel}>{t('home.lowMood.help')}</Text>
        </Pressable>
      </View>
      <IconButton accessibilityLabel={t('home.lowMood.dismiss')} onPress={dismiss}>
        <CloseIcon color={colors.textSecondary} size={18} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.m,
    padding: spacing.card,
    paddingRight: spacing.m,
    paddingTop: spacing.m,
    marginBottom: spacing.s,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
  },
  texts: {
    flex: 1,
    gap: spacing.s,
    paddingTop: spacing.s,
  },
  text: {
    ...typography.paragraphSmall,
    color: colors.text,
  },
  emergency: {
    ...typography.paragraphSmall,
    color: colors.textSecondary,
  },
  // A text button in the text color, never the accent: the card stays calm.
  help: {
    minHeight: sizes.touchTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: pressedOpacity,
  },
  helpLabel: {
    ...typography.secondaryButton,
    color: colors.text,
  },
});
