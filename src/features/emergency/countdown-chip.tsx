import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { countdownMs, countdownParts, type MinutesAndSeconds } from '@/domain/urge';
import { useClock } from '@/features/clock/clock-context';
import { sameFields } from '@/features/clock/minute-clock';
import { countdownText, spokenCountdown } from '@/features/emergency/labels';
import { colors, radii, spacing, typography } from '@/ui/theme';

function countdownAt(elapsed: number): MinutesAndSeconds {
  return countdownParts(countdownMs(elapsed));
}

// Reads the screen's elapsed clock.
export function CountdownChip() {
  const { t } = useTranslation();
  const parts = useClock(countdownAt, sameFields);
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={spokenCountdown(t, parts)}
      style={styles.chip}
    >
      <Text maxFontSizeMultiplier={1.5} style={styles.text}>
        {countdownText(parts)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    justifyContent: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  text: {
    ...typography.countdown,
    color: colors.text,
  },
});
