import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FlustSymbol } from '@/ui/brand/flust-symbol';
import { colors, radii, spacing, typography } from '@/ui/theme';

type NotificationPreviewProps = { text: string; time: string };

// What a reminder looks like: the app name and neutral text, nothing more.
export function NotificationPreview({ text, time }: NotificationPreviewProps) {
  const { t } = useTranslation();
  return (
    <View accessible accessibilityLabel={t('reminders.previewLabel', { text })} style={styles.card}>
      <View style={styles.icon}>
        <FlustSymbol height={24} />
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.name}>{t('app.name')}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.l,
    padding: spacing.l,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.surface,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.segment,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.s,
  },
  name: {
    ...typography.row,
    color: colors.text,
  },
  time: {
    ...typography.body,
    color: colors.textSecondary,
  },
  text: {
    ...typography.bodyLarge,
    color: colors.text,
  },
});
