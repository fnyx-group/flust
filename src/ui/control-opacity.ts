import { disabledOpacity, pressedOpacity } from '@/ui/theme';

// A disabled control stays faint even under a finger, so it never looks available.
export function controlOpacity(pressed: boolean, disabled: boolean): { opacity: number } {
  if (disabled) return { opacity: disabledOpacity };
  return { opacity: pressed ? pressedOpacity : 1 };
}
