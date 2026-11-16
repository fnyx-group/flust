export type OpenOutcome = 'opened' | 'failed';

// No canOpenURL check first: it needs the schemes declared on iOS and package visibility on
// Android, and a phone app that is missing shows up as a failure here anyway.
export async function openHelp(
  open: (url: string) => Promise<unknown>,
  url: string,
): Promise<OpenOutcome> {
  try {
    await open(url);
    return 'opened';
  } catch {
    return 'failed';
  }
}
