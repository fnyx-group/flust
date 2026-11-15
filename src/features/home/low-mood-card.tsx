import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { showLowMoodCard } from '@/domain/check-in';
import { localDayNumber } from '@/domain/local-time';
import { useClock } from '@/features/clock/clock-context';
import { useSession } from '@/features/session/session-context';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { useStorage } from '@/features/storage/storage-context';
import { IconButton } from '@/ui/icon-button';
import { CloseIcon } from '@/ui/icons/close-icon';
import { colors, radii, spacing, typography } from '@/ui/theme';

// A calm card after several low mood check-ins: no red, no accent, no animation. It suggests
// talking to someone and names the emergency number without a country, until the help page
// brings numbers by country. Closing it hides it until the next local day.
export function LowMoodCard() {
  const { t } = useTranslation();
  const storage = useStorage();
  const { checkIns, lowMoodDismissedDay, dismissLowMood } = useSession();
  const today = useClock((now) => localDayNumber(now, deviceOffsetAt));
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
});
