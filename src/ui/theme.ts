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
  quote: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 26 },
  welcomeTitle: { fontFamily: fonts.extraBold, fontSize: 40, lineHeight: 46 },
  brandLockup: { fontFamily: fonts.extraBold, fontSize: 36 },
  screenTitle: { fontFamily: fonts.extraBold, fontSize: 28 },
  rankName: { fontFamily: fonts.extraBold, fontSize: 22 },
  unlockRankName: { fontFamily: fonts.extraBold, fontSize: 40, lineHeight: 46 },
  unlockLabel: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 3 },
  selectValue: { fontFamily: fonts.extraBold, fontSize: 17 },
  countdown: { fontFamily: fonts.numberSemiBold, fontSize: 22, fontVariant: ['tabular-nums'] },
  breathingCount: {
    fontFamily: fonts.numberSemiBold,
    fontSize: 56,
    lineHeight: 60,
    fontVariant: ['tabular-nums'],
  },
  summaryNumber: {
    fontFamily: fonts.numberSemiBold,
    fontSize: 48,
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  breathingPhase: { fontFamily: fonts.semiBold, fontSize: 20 },
  stepperValue: { fontFamily: fonts.numberSemiBold, fontSize: 32, fontVariant: ['tabular-nums'] },
  calendarDay: { fontFamily: fonts.numberMedium, fontSize: 18, fontVariant: ['tabular-nums'] },
  row: { fontFamily: fonts.semiBold, fontSize: 15 },
  badgeName: { fontFamily: fonts.extraBold, fontSize: 15 },
  body: { fontFamily: fonts.regular, fontSize: 15 },
  bodyLarge: { fontFamily: fonts.regular, fontSize: 16 },
  label: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textSecondary },
  caption: { fontFamily: fonts.regular, fontSize: 12 },
  badgeDetail: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textSecondary },
  weekdayInitial: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.textSecondary },
  primaryButton: { fontFamily: fonts.extraBold, fontSize: 17 },
  secondaryButton: { fontFamily: fonts.semiBold, fontSize: 15 },
  tabLabel: { fontFamily: fonts.semiBold, fontSize: 11 },
} as const satisfies Record<string, TextStyle>;

// Days by number of digits: 2 or fewer, 3, then 4 or more. Hours by their own digits: 1, then 2,
// always followed by two minute digits. Each size is the largest whole size that keeps the widest
// counter of its group on one line across the screen width minus its padding, at
// sizes.counterDesignWidth, in both languages (labels.test.ts checks both bounds).
export const counterFontSizes: Record<CounterSize, number> = {
  large: 226,
  medium: 150,
  small: 113,
  hoursMedium: 141,
  hoursSmall: 105,
};

export const spacing = {
  screen: 20,
  screenTop: 60,
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const pressedOpacity = 0.8;

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
  badgeRing: 56,
  badgeRingStroke: 3,
  badgeEmblem: 28,
  currentRankEmblem: 64,
  gridEmblem: 36,
  unlockEmblem: 120,
  unlockRings: 300,
  starSmall: 10,
  starLarge: 18,
  currentRankOutline: 1.5,
  weekBarHeight: 6,
  quoteBarWidth: 3,
  breathingRing: 220,
  breathingCircle: 170,
  breathingStroke: 3,
  // The narrowest screen width the streak counter sizes are chosen for.
  counterDesignWidth: 360,
} as const;
