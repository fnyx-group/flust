import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { unlockText } from '@/features/ranks/labels';
import { fromUnlockParams, type UnlockScreenData } from '@/features/ranks/unlock-params';
import { revealTextStyle, UnlockReveal, useRevealProgress } from '@/features/ranks/unlock-reveal';
import { Button } from '@/ui/button';
import { RankStars } from '@/ui/rank-stars';
import { Screen } from '@/ui/screen';
import { ScrollView } from '@/ui/scroll-view';
import { colors, sizes, spacing, typography } from '@/ui/theme';

// The ranks were stored when this screen was opened (see useRankUnlockTrigger), so it only shows.
export function RankUnlockedScreen() {
  const params = useLocalSearchParams<{ ranks?: string; days?: string }>();
  const data = fromUnlockParams(params);
  if (data === null) return <Redirect href="/" />;
  return <RankUnlocked {...data} />;
}

function RankUnlocked({ unlock, totalCleanDays }: UnlockScreenData) {
  const { t } = useTranslation();
  const text = unlockText(t, unlock, totalCleanDays);
  const progress = useRevealProgress();

  // Queued so that iOS does not drop it while VoiceOver reads the screen change.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibilityWithOptions(text.announcement, { queue: true });
  }, [text.announcement]);

  return (
    <Screen bottomInset>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.middle}>
          <UnlockReveal rank={unlock.highest} progress={progress} />
          <Animated.View style={[styles.texts, revealTextStyle(progress)]}>
            <Text style={styles.label}>{t('ranks.unlocked.label')}</Text>
            <Text accessibilityRole="header" style={styles.name}>
              {text.name}
            </Text>
            <RankStars circle={unlock.highest.circle} color={colors.text} size={sizes.starLarge} />
            <Text style={styles.line}>{text.line}</Text>
            {text.others !== null && <Text style={styles.others}>{text.others}</Text>}
          </Animated.View>
        </View>
        <View style={styles.actions}>
          <Button label={t('ranks.unlocked.continue')} onPress={() => router.back()} />
          <Button
            label={t('ranks.unlocked.seeRanks')}
            variant="plain"
            onPress={() => router.dismissTo('/ranks')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // flexGrow centers the reveal in the free height, and lets the screen scroll with large text.
  content: {
    flexGrow: 1,
  },
  middle: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.xl,
  },
  texts: {
    alignItems: 'center',
    gap: spacing.m,
  },
  label: {
    ...typography.unlockLabel,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  name: {
    ...typography.unlockRankName,
    color: colors.text,
    textAlign: 'center',
  },
  line: {
    ...typography.bodyLarge,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  others: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.s,
  },
});
