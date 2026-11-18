import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppIcon } from '@/ui/brand/app-icon';
import { colors, radii, spacing, typography } from '@/ui/theme';

type NotificationPreviewProps = { text: string };

// What a reminder looks like: the app name and neutral text, nothing more.
export function NotificationPreview({ text }: NotificationPreviewProps) {
  const { t } = useTranslation();
  return (
    <View accessible accessibilityLabel={t('reminders.previewLabel', { text })} style={styles.card}>
      <AppIcon size={44} />
      <View style={styles.body}>
        <Text style={styles.name}>{t('app.name')}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    padding: spacing.l,
    borderRadius: radii.cardLarge,
    backgroundColor: colors.lockedFill,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.badgeName,
    color: colors.text,
  },
  text: {
    ...typography.bodyLarge,
    color: colors.text,
  },
});
