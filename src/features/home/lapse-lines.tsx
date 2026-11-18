import { useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Journey } from '@/domain/journey';
import { canUndo, inSupportWindow, type LapseRecord } from '@/domain/lapse';
import { useClock } from '@/features/clock/clock-context';
import { undoLapse } from '@/features/lapse/undo-lapse';
import { useSession } from '@/features/session/session-context';
import { deviceOffsetAt } from '@/features/shared/device-time';
import { useStorage } from '@/features/storage/storage-context';
import { controlOpacity } from '@/ui/control-opacity';
import { colors, sizes, spacing, typography } from '@/ui/theme';

// One short line at the end of the scrolling content during the hours after a lapse. Plain text:
// no color, no record, no animation.
export function SupportLine({ latestLapse }: { latestLapse: LapseRecord | null }) {
  const { t } = useTranslation();
  const shown = useClock((now) => inSupportWindow(latestLapse, now));
  if (!shown) return null;
  return <Text style={styles.support}>{t('home.lapse.support')}</Text>;
}

type UndoLineProps = { journey: Journey; latestLapse: LapseRecord | null };

// "Lapse noted." and the undo button, until local midnight and at least an hour after the lapse
// was logged.
export function UndoLine({ journey, latestLapse }: UndoLineProps) {
  const shown = useClock((now) => canUndo(latestLapse, now, deviceOffsetAt));
  if (!shown || latestLapse === null) return null;
  // A new lapse gets a fresh line, so an error about the previous one never stays on screen.
  return <Undo key={latestLapse.id} journey={journey} record={latestLapse} />;
}

function Undo({ journey, record }: { journey: Journey; record: LapseRecord }) {
  const { t } = useTranslation();
  const storage = useStorage();
  const { setLapses } = useSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // State updates land one render later, so a second tap in the same frame still sees busy false.
  const undoing = useRef(false);

  async function undo() {
    if (undoing.current) return;
    undoing.current = true;
    setBusy(true);
    setFailed(false);
    const result = await undoLapse(storage.lapses, journey, record);
    undoing.current = false;
    setBusy(false);
    if (result.ok) {
      setLapses(result.value.journey, result.value.latestLapse);
      return;
    }
    setFailed(true);
    if (Platform.OS === 'ios')
      AccessibilityInfo.announceForAccessibility(t('home.lapse.undoFailed'));
  }

  return (
    <View style={styles.undo}>
      <View style={styles.undoRow}>
        <Text style={styles.noted}>{t('home.lapse.noted')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.lapse.undoSpoken')}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          hitSlop={spacing.s}
          onPress={undo}
          style={({ pressed }) => [styles.undoButton, controlOpacity(pressed, busy)]}
        >
          <Text style={styles.undoLabel}>{t('home.lapse.undo')}</Text>
        </Pressable>
      </View>
      {failed && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.noted}>
          {t('home.lapse.undoFailed')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  support: {
    ...typography.paragraphSmall,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  undo: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  undoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
  },
  noted: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  undoButton: {
    minHeight: sizes.touchTarget,
    justifyContent: 'center',
  },
  undoLabel: {
    ...typography.caption,
    fontFamily: typography.row.fontFamily,
    color: colors.text,
    textDecorationLine: 'underline',
  },
});
