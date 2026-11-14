import type { TextStyle } from 'react-native';

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
  streakDays: {
    fontFamily: fonts.numberSemiBold,
    fontSize: 240,
    fontVariant: ['tabular-nums'],
  },
  streakHours: {
    fontFamily: fonts.numberSemiBold,
    fontSize: 176,
    fontVariant: ['tabular-nums'],
  },
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
} as const;
