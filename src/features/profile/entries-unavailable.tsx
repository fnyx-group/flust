import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useGoBack } from '@/features/navigation/use-go-back';
import { BackHeader } from '@/ui/back-header';
import { Button } from '@/ui/button';
import { Screen } from '@/ui/screen';
import { colors, spacing, typography } from '@/ui/theme';

type EntriesUnavailableProps = {
  // Null while reading, when only the way back shows.
  message: string | null;
  onRetry?: () => void;
};

// Shown in place of a list or an editor that cannot show yet. The way back is there from the
// start, so a slow read never traps the user.
export function EntriesUnavailable({ message, onRetry }: EntriesUnavailableProps) {
  const goBack = useGoBack('/settings');
  const { t } = useTranslation();

  // Android reads the message through its live region; iOS has no live regions.
  useEffect(() => {
    if (message !== null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);

  return (
    <Screen bottomInset>
      <BackHeader backLabel={t('profile.back')} onBack={goBack} />
      {message !== null && (
        <View style={styles.centered}>
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>
            {message}
          </Text>
          {onRetry !== undefined && (
            <Button variant="secondary" label={t('profile.retry')} onPress={onRetry} />
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.l,
  },
  message: {
    ...typography.paragraph,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});
