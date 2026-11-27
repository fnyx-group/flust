import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ShieldIcon } from '@/ui/icons/shield-icon';
import { colors, pressedOpacity, radii, sizes, spacing, typography } from '@/ui/theme';

const HEIGHT = 36;

// Takes the place of the circle name in the home header while the filter is inactive, so home
// keeps its height and its fit on a 667 point phone. Neutral: no circle color, no red.
export function FilterChip() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.filterInactive')}
      accessibilityHint={t('home.filterInactiveHint')}
      hitSlop={(sizes.touchTarget - HEIGHT) / 2}
      onPress={() => router.push('/filter')}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <ShieldIcon color={colors.text} size={18} />
      <Text style={styles.label}>{t('home.filterInactive')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexShrink: 1,
    minHeight: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  label: {
    ...typography.row,
    flexShrink: 1,
    color: colors.text,
  },
});
