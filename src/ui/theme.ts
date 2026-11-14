import type { TextStyle } from 'react-native';

import type { CounterSize } from '@/domain/streak';

export const colors = {
  background: '#111116',
  surface: '#1A1A21',
  separator: '#2A2A33',
  locked: '#5C5B66',
  textSecondary: '#B9B8C2',
  text: '#FFFFFF',
  accent: '#7B6BFF',
  onAccent: '#111116',
} as const;

// Each weight is a separate family because Android ignores fontWeight on custom fonts.
export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
  numberMedium: 'BarlowCondensed_500Medium',
  numberSemiBold: 'BarlowCondensed_600SemiBold',
} as const;

export const typography = {
  // The size comes from counterFontSizes.
  streakNumber: { fontFamily: fonts.numberSemiBold, fontVariant: ['tabular-nums'] },
  streakUnit: { fontFamily: fonts.semiBold, fontSize: 40, color: colors.textSecondary },
  sectionLabel: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.textSecondary },
  quote: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30 },
  welcomeTitle: { fontFamily: fonts.extraBold, fontSize: 40, lineHeight: 46 },
  brandLockup: { fontFamily: fonts.extraBold, fontSize: 36 },
  screenTitle: { fontFamily: fonts.extraBold, fontSize: 28 },
  rankName: { fontFamily: fonts.extraBold, fontSize: 22 },
  selectValue: { fontFamily: fonts.extraBold, fontSize: 17 },
  stepperValue: { fontFamily: fonts.numberSemiBold, fontSize: 32, fontVariant: ['tabular-nums'] },
  calendarDay: { fontFamily: fonts.numberMedium, fontSize: 18, fontVariant: ['tabular-nums'] },
  row: { fontFamily: fonts.semiBold, fontSize: 15 },
  body: { fontFamily: fonts.regular, fontSize: 15 },
  bodyLarge: { fontFamily: fonts.regular, fontSize: 16 },
  label: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textSecondary },
  caption: { fontFamily: fonts.regular, fontSize: 12 },
  primaryButton: { fontFamily: fonts.extraBold, fontSize: 17 },
  secondaryButton: { fontFamily: fonts.semiBold, fontSize: 15 },
  tabLabel: { fontFamily: fonts.semiBold, fontSize: 11 },
} as const satisfies Record<string, TextStyle>;

// By number of digits: 2 or fewer, 3, then 4 or more. Hours count with their two minute digits,
// so 7 h 40 is 176 like 3-digit days.
export const counterFontSizes: Record<CounterSize, number> = {
  large: 240,
  medium: 176,
  small: 128,
};

export const spacing = {
  screen: 20,
  screenTop: 60,
} as const;

export const radii = {
  card: 20,
  cardLarge: 22,
  primaryButton: 18,
  secondaryButton: 16,
  segmentedControl: 16,
  segment: 12,
  iconButton: 20,
  tabHighlight: 12,
  pill: 999,
} as const;

export const sizes = {
  primaryButtonHeight: 58,
  secondaryButtonHeight: 48,
  secondaryButtonHeightLarge: 50,
  iconButton: 40,
  switchWidth: 48,
  switchHeight: 28,
  // The minimum touch target on both platforms.
  touchTarget: 44,
  radio: 24,
  emblem: 48,
  meterHeight: 6,
} as const;
