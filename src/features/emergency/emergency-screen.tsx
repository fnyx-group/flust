import { useNavigation, useRouter, type ImperativeRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Profile } from '@/data/profile-repository';
import { countdownMs } from '@/domain/urge';
import { ClockContext, useClock } from '@/features/clock/clock-context';
import { createElapsedClock } from '@/features/clock/elapsed-clock';
import { nativeElapsedClockDeps } from '@/features/clock/native-clock';
import { BreathingCircle } from '@/features/emergency/breathing-circle';
import { CountdownChip } from '@/features/emergency/countdown-chip';
import { PlansCard, ReasonsList } from '@/features/emergency/profile-cards';
import { startUrgeVisit, type UrgeVisit } from '@/features/emergency/urge-visit';
import { handOffVisit } from '@/features/emergency/visit-handoff';
import { useWhenFocused } from '@/features/shared/use-when-focused';
import { useStorage } from '@/features/storage/storage-context';
import { Button } from '@/ui/button';
import { IconButton } from '@/ui/icon-button';
import { CloseIcon } from '@/ui/icons/close-icon';
import { HeartIcon } from '@/ui/icons/heart-icon';
import { PencilIcon } from '@/ui/icons/pencil-icon';
import { NavRow } from '@/ui/nav-row';
import { RowGroup } from '@/ui/row-group';
import { Screen } from '@/ui/screen';
import { ScreenTitle } from '@/ui/screen-title';
import { ScrollView } from '@/ui/scroll-view';
import { colors, spacing, typography } from '@/ui/theme';

// Everything on this screen runs on the time elapsed since it opened, read on each tick of a
// one-second clock that follows a monotonic time (see createElapsedClock), so a call, the app in
// the background or a change of the phone's time never breaks the countdown or the breathing. The
// plan and the reasons are read in the background and appear when they are ready:
// nothing here waits on storage.
export function EmergencyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const storage = useStorage();
  const navigation = useNavigation();
  const [openedAt] = useState(() => Date.now());
  const [clock] = useState(() => createElapsedClock(nativeElapsedClockDeps));
  const [profile, setProfile] = useState<Profile | null>(null);
  const visit = useRef<UrgeVisit | null>(null);
  // Set once the lapse screen has taken the visit over: it ends the visit from then on.
  const handedOff = useRef(false);
  const whenFocused = useWhenFocused();

  // Effects can run twice in development; the ref keeps a single visit per screen.
  useEffect(() => {
    visit.current ??= startUrgeVisit(storage.urges, openedAt);
  }, [storage, openedAt]);

  // Every way out removes the screen: the close button, the Android back button, or a button
  // below that has already given its own outcome, which then wins. Unlike unmounting, removal
  // never happens twice in development. The event comes after the cleanup, so unsubscribing waits.
  useEffect(() => {
    const unsubscribe = navigation.addListener('removed', () => {
      if (!handedOff.current) void visit.current?.finish('closed', Date.now());
    });
    return () => queueMicrotask(unsubscribe);
  }, [navigation]);

  useEffect(() => {
    let active = true;
    void storage.profile.load().then((result) => {
      if (active && result.ok) setProfile(result.value);
    });
    return () => {
      active = false;
    };
  }, [storage]);

  function held() {
    void visit.current?.finish('held', Date.now());
    router.back();
  }

  // The visit ends on the lapse screen: as a lapse once it is saved, as closed if the user goes
  // back without saving.
  function lapse() {
    const current = visit.current;
    if (current === null) {
      router.replace('/lapse');
      return;
    }
    handedOff.current = true;
    router.replace({ pathname: '/lapse', params: { visit: handOffVisit(current) } });
  }

  const plans = profile?.plans ?? [];
  const reasons = profile?.reasons ?? [];

  return (
    <Screen bottomInset>
      <ClockContext value={clock}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <IconButton accessibilityLabel={t('emergency.close')} onPress={() => router.back()}>
              <CloseIcon color={colors.text} />
            </IconButton>
            <CountdownChip />
          </View>
          <View style={styles.intro}>
            <ScreenTitle>{t('emergency.title')}</ScreenTitle>
            <Text style={styles.subtitle}>{t('emergency.subtitle')}</Text>
            <WaveOver />
          </View>
          <BreathingCircle />
          {plans.length > 0 && <PlansCard plans={plans} />}
          {reasons.length > 0 && <ReasonsList reasons={reasons} />}
          <RowGroup>
            <NavRow
              label={t('emergency.writeNote')}
              icon={{ icon: PencilIcon, color: colors.accent }}
              onPress={() => whenFocused(() => writeNote(router))}
            />
            <NavRow
              label={t('emergency.darkThoughts')}
              icon={{ icon: HeartIcon, color: colors.teal }}
              accessibilityHint={t('emergency.darkThoughtsHint')}
              onPress={() => whenFocused(() => openHelp(router))}
            />
          </RowGroup>
          <View style={styles.actions}>
            <Button label={t('emergency.held')} onPress={held} />
            <Button variant="plain" label={t('emergency.lapse')} onPress={lapse} />
          </View>
        </ScrollView>
      </ClockContext>
    </Screen>
  );
}

// The note opens over this screen, which stays open with its countdown running. It is offered
// with every plan, not only one that says to write.
function writeNote(router: ImperativeRouter) {
  router.push('/note');
}

// Help opens over this screen too, so the visit and the countdown keep running underneath. Opening
// it is not recorded.
function openHelp(router: ImperativeRouter) {
  router.push('/help');
}

function isWaveOver(elapsed: number): boolean {
  return countdownMs(elapsed) === 0;
}

// Shown once the countdown reaches zero, and announced once.
function WaveOver() {
  const { t } = useTranslation();
  const over = useClock(isWaveOver);
  const text = t('emergency.waveOver');

  useEffect(() => {
    if (over && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  }, [over, text]);

  if (!over) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={styles.waveOver}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  intro: {
    gap: spacing.s,
  },
  subtitle: {
    ...typography.paragraph,
    color: colors.textSecondary,
  },
  waveOver: {
    ...typography.row,
    color: colors.text,
  },
  // The free space goes above the exits, which stay at the bottom when everything fits.
  actions: {
    marginTop: 'auto',
    gap: spacing.xs,
  },
});
