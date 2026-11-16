export type TextFile = {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
  remove(): Promise<void>;
};

export type LaunchMode = 'normal' | 'safe-mode';

// Two launches in a row that never reached a first screen: the third opens in safe mode.
export const SAFE_MODE_AFTER = 2;

const COUNT = /^\d{1,6}$/;

// A plain file holding the number of launches that started and did not reach a first screen.
// It holds nothing else, so it needs no encryption, and it can be read before storage opens.
// A file that cannot be read counts as zero: a broken counter must never trap the app in safe
// mode. See docs/decisions/0028-error-boundaries-and-safe-mode.md.
export type LaunchGuard = ReturnType<typeof createLaunchGuard>;

export function createLaunchGuard(file: TextFile) {
  async function unfinished(): Promise<number> {
    try {
      const text = await file.read();
      return text !== null && COUNT.test(text) ? Number(text) : 0;
    } catch {
      return 0;
    }
  }

  return {
    async begin(): Promise<LaunchMode> {
      const count = await unfinished();
      if (count >= SAFE_MODE_AFTER) return 'safe-mode';
      await file.write(String(count + 1)).catch(() => undefined);
      return 'normal';
    },
    // A counter left at two would open safe mode on every launch, so when the file cannot be
    // removed it is set to zero instead. Resolves to false when neither worked.
    async finish(): Promise<boolean> {
      try {
        await file.remove();
        return true;
      } catch {
        return file.write('0').then(
          () => true,
          () => false,
        );
      }
    },
  };
}
