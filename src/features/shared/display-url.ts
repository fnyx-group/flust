// The address as people would type it, shown next to a link so it can be checked before opening.
export function displayUrl(url: string): string {
  return url.replace(/^https:\/\//, '').replace(/\/$/, '');
}
