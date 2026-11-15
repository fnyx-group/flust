import { redirectLink } from '@/features/lock/held-navigation';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  return redirectLink(path, initial);
}
