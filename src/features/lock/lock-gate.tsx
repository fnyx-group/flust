import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BackHandler, Keyboard, StyleSheet, View } from 'react-native';

import type { Storage } from '@/data/open-storage';
import {
  DEFAULT_LOCK_SETTINGS,
  NO_ATTEMPTS,
  type Attempts,
  type LockSettings,
} from '@/domain/lock';
import { nativeElapsedClockDeps } from '@/features/clock/native-clock';
import { useFirstScreenShown } from '@/features/errors/launch-context';
import { setLocked } from '@/features/lock/held-navigation';
import { deviceSecurity, type DeviceSecurity } from '@/features/lock/local-auth';
import { LockContext, type LockApi } from '@/features/lock/lock-context';
import { createLockController, type LockController } from '@/features/lock/lock-controller';
import { LockCover, LockScreen } from '@/features/lock/lock-screen';
import { protectScreen } from '@/features/lock/privacy-screen';
import { applyStoredLanguage } from '@/features/session/load-session';
import { useStorage } from '@/features/storage/storage-context';
import { OverlaysHiddenContext } from '@/ui/overlays';

type Loaded = {
  readonly controller: LockController;
  readonly settings: LockSettings;
  readonly security: DeviceSecurity;
  readonly attempts: Attempts;
};

// Stands in front of every route. While locked at launch nothing below it is rendered, so the
// session, and with it any data, is not even loaded. A relock later covers the app instead, so
// navigation and text being written are kept, and closes sheets, which would float above.
export function LockGate({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    protectScreen();
  }, []);

  useEffect(() => {
    let active = true;
    void load(storage).then((result) => {
      if (active) setLoaded(result);
    });
    return () => {
      active = false;
    };
  }, [storage]);

  const controller = loaded?.controller;
  useEffect(() => controller?.start(), [controller]);

  if (loaded === null) return null;
  return <Gate loaded={loaded}>{children}</Gate>;
}

async function load(storage: Storage): Promise<Loaded> {
  const [settings, attempts, security] = await Promise.all([
    storage.lock.loadSettings(),
    storage.lock.loadAttempts(Date.now()),
    deviceSecurity(),
    applyStoredLanguage(storage),
  ]);
  // Settings that cannot be read keep the lock on, so a failure never opens the app unasked.
  const stored = settings.ok ? settings.value : { ...DEFAULT_LOCK_SETTINGS, enabled: true };
  return {
    settings: stored,
    security,
    attempts: attempts.ok ? attempts.value : NO_ATTEMPTS,
    controller: createLockController(
      { settings: effective(stored, security), locked: true },
      nativeElapsedClockDeps,
    ),
  };
}

// Without a screen lock on the device, the lock is paused: it could not ask, and removing the
// screen lock already took the device passcode.
function effective(settings: LockSettings, security: DeviceSecurity): LockSettings {
  return security.kind === 'none' ? { ...settings, enabled: false } : settings;
}

type GateProps = {
  loaded: Loaded;
  children: ReactNode;
};

function Gate({ loaded, children }: GateProps) {
  const { controller } = loaded;
  const [settings, setSettings] = useState(loaded.settings);
  const [security, setSecurity] = useState(loaded.security);
  // The latest values for handlers that change one and then the other in a row.
  const latest = useRef({ settings: loaded.settings, security: loaded.security });
  const status = useSyncExternalStore(controller.subscribe, controller.status);
  const [everUnlocked, setEverUnlocked] = useState(status === 'unlocked');
  const firstScreenShown = useFirstScreenShown();
  const [attempts, setAttempts] = useState(loaded.attempts);
  const hidden = status !== 'unlocked';

  if (!hidden && !everUnlocked) setEverUnlocked(true);

  useEffect(() => {
    setLocked(hidden);
    if (hidden) Keyboard.dismiss();
  }, [hidden]);

  // The screens below stay mounted under the cover: the back button must not reach them.
  useEffect(() => {
    if (!hidden) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [hidden]);

  // With the lock off, SessionGate hides the splash once the first screen is loaded.
  useEffect(() => {
    if (!everUnlocked) firstScreenShown();
  }, [everUnlocked, firstScreenShown]);

  const api: LockApi = {
    settings,
    security,
    paused: settings.enabled && security.kind === 'none',
    locked: hidden,
    applySettings(next) {
      latest.current = { ...latest.current, settings: next };
      controller.setSettings(effective(next, latest.current.security));
      setSettings(next);
    },
    async refreshSecurity() {
      const next = await deviceSecurity();
      latest.current = { ...latest.current, security: next };
      controller.setSettings(effective(latest.current.settings, next));
      setSecurity(next);
      return next;
    },
    withSystemScreen: (task) => controller.withSystemScreen(task),
  };

  // The screen lock may have been added or removed while the app was away: read it again before
  // deciding whether to ask.
  const refreshSecurity = useRef(api.refreshSecurity);
  useEffect(() => {
    refreshSecurity.current = api.refreshSecurity;
  });
  useEffect(() => {
    controller.beforeDeciding(() => refreshSecurity.current());
    return () => controller.beforeDeciding(null);
  }, [controller]);

  const lockScreen = (
    <LockScreen
      security={security}
      attempts={attempts}
      onAttempts={setAttempts}
      onUnlock={() => controller.unlock()}
    />
  );

  if (!everUnlocked) {
    return <LockContext value={api}>{lockScreen}</LockContext>;
  }

  return (
    <LockContext value={api}>
      <OverlaysHiddenContext value={hidden}>
        <View
          style={styles.fill}
          accessibilityElementsHidden={hidden}
          importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
        {hidden && (
          <View style={StyleSheet.absoluteFill}>
            {status === 'locked' ? lockScreen : <LockCover />}
          </View>
        )}
      </OverlaysHiddenContext>
    </LockContext>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
