// flust registers no URL scheme in production (docs/decisions/0035-no-url-scheme-in-production.md).
// Should a link still reach the app, it opens no screen: one that launches the app lands on
// home, and one that arrives while the app runs is ignored, so it can neither record a visit nor
// close a note being written.
export function redirectIncomingLink({
  initial,
}: {
  path: string;
  initial: boolean;
}): string | null {
  return initial ? '/' : null;
}
