import { usePreventRemove } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useGoBack } from '@/features/navigation/use-go-back';
import { BackHeader } from '@/ui/back-header';
import { Button } from '@/ui/button';
import { ConfirmSheet } from '@/ui/confirm-sheet';
import { KeyboardScreen } from '@/ui/keyboard-screen';
import { ScreenTitle } from '@/ui/screen-title';
import { colors, spacing, typography } from '@/ui/theme';

// Each run resolves to an error message, or null once it is done.
type Run = () => Promise<string | null>;

type Removal = {
  label: string;
  confirm: { title: string; cancel: string; confirm: string };
  run: Run;
};

type EditorShellProps = {
  title: string;
  dirty: boolean;
  canSave: boolean;
  save: Run;
  removal?: Removal;
  // A line under the content, such as why a plan cannot be deleted.
  note?: string;
  children: ReactNode;
};

type Sheet = { kind: 'leave'; leave: () => void } | { kind: 'remove' } | null;

// The frame of the reason and plan screens. Every way out, the back button, Android back or a
// gesture, asks first when there are unsaved changes, and nothing can leave while a save or a
// removal runs. The screen closes once either is stored.
export function EditorShell({
  title,
  dirty,
  canSave,
  save,
  removal,
  note,
  children,
}: EditorShellProps) {
  const goBack = useGoBack('/reasons-and-plans');
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  // Set once the screen may close without asking: after a save, a removal or a discard.
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  // State updates land one render later, so a second tap in the same frame still sees busy false.
  const working = useRef(false);

  const allowRemove = usePreventRemove(busy || (dirty && !done), ({ repeat }) => {
    if (!working.current) setSheet({ kind: 'leave', leave: repeat });
  });

  // busy and done drive usePreventRemove: they change in the same handler as allowRemove, so the
  // prop and the prevention state stay in sync. working stays set, so nothing else starts.
  function close() {
    setBusy(false);
    setDone(true);
    allowRemove();
    goBack();
  }

  // Android reads the message through its live region; iOS has no live regions.
  function showError(message: string) {
    setError(message);
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }

  async function perform(run: Run) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    const failure = await run();
    if (failure === null) {
      close();
      return;
    }
    working.current = false;
    setBusy(false);
    showError(failure);
  }

  return (
    <KeyboardScreen
      contentContainerStyle={styles.content}
      header={<BackHeader backLabel={t('profile.back')} disabled={busy} onBack={goBack} />}
      footer={
        <View style={styles.footer}>
          {error !== null && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          )}
          <Button
            label={t('profile.save')}
            disabled={busy || !canSave}
            onPress={() => void perform(save)}
          />
          {removal !== undefined && (
            <Button
              variant="destructive"
              label={removal.label}
              disabled={busy}
              onPress={() => setSheet({ kind: 'remove' })}
            />
          )}
        </View>
      }
      overlay={
        <>
          <ConfirmSheet
            visible={sheet?.kind === 'leave'}
            title={t('profile.leave.title')}
            message={t('profile.leave.message')}
            cancelLabel={t('profile.leave.keep')}
            confirmLabel={t('profile.leave.discard')}
            onCancel={() => setSheet(null)}
            onConfirm={() => {
              if (sheet?.kind !== 'leave') return;
              setSheet(null);
              setDone(true);
              sheet.leave();
            }}
          />
          {removal !== undefined && (
            <ConfirmSheet
              visible={sheet?.kind === 'remove'}
              title={removal.confirm.title}
              cancelLabel={removal.confirm.cancel}
              confirmLabel={removal.confirm.confirm}
              destructive
              onCancel={() => setSheet(null)}
              onConfirm={() => {
                setSheet(null);
                void perform(removal.run);
              }}
            />
          )}
        </>
      }
    >
      <ScreenTitle>{title}</ScreenTitle>
      {children}
      {note !== undefined && <Text style={styles.note}>{note}</Text>}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xl,
  },
  footer: {
    gap: spacing.xs,
    paddingTop: spacing.m,
  },
  note: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  error: {
    ...typography.body,
    textAlign: 'center',
    color: colors.text,
    paddingBottom: spacing.s,
  },
});
