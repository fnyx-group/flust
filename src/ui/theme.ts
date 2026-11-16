import type { TextStyle } from 'react-native';

import type { CounterSize } from '@/domain/streak';

export const colors = {
  background: '#111116',
  surface: '#1A1A21',
  separator: '#2A2A33',
  // Locked emblems, stars, bars and borders. Too dark for text: see muted.
  locked: '#5C5B66',
  // Text that must read as dimmed, such as locked rank names, placeholders and unavailable days.
  // At least 4.5:1 on the background and on the surface, unlike locked.
  muted: '#8A8994',
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
  wheelSelected: { fontFamily: fonts.numberSemiBold, fontSize: 30, fontVariant: ['tabular-nums'] },
  wheelRow: { fontFamily: fonts.numberMedium, fontSize: 22, fontVariant: ['tabular-nums'] },
  scaleValue: { fontFamily: fonts.semiBold, fontSize: 22 },
  row: { fontFamily: fonts.semiBold, fontSize: 15 },
  badgeName: { fontFamily: fonts.extraBold, fontSize: 15 },
  body: { fontFamily: fonts.regular, fontSize: 15 },
  bodyLarge: { fontFamily: fonts.regular, fontSize: 16 },
  // Body text that can run over several lines.
  paragraph: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  paragraphSmall: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
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
  card: 20,
  chipHorizontal: 18,
  chipVertical: 10,
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  // Inside a row of a card: select, radio, text entry and navigation rows.
  rowHorizontal: 20,
  rowVertical: 14,
} as const;

// Above this text scale, rows that put two texts side by side stack them, and grids lose a column.
export const largeTextScale = 1.3;

// The only texts that do not grow freely with the system text size, each capped because its
// place has a fixed size. Screen readers read each of them in full. See
// docs/decisions/0032-accessibility-pass.md.
export const maxFontScale = {
  // Already the largest text on screen, sized to fit one line across the screen.
  streakCounter: 1,
  // Inside the 220 point ring, whose circle shrinks to 70 percent.
  breathing: 1,
  // Two 48 point numbers side by side.
  lapseSummary: 1.2,
  // In the header row, next to the close button.
  countdown: 1.5,
  // Rows are 44 points high, the interval the wheel snaps to.
  wheel: 1.2,
  // The tab bar has a fixed height. iOS shows the label large on a long press.
  tabLabel: 1.3,
} as const;

export const pressedOpacity = 0.8;

// Clearly fainter than a pressed control, so a disabled button never looks available.
export const disabledOpacity = 0.4;

// The background color under a sheet, so the screen behind stays faintly visible.
export const backdropOpacity = 0.85;

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
  row: 60,
  // Chevrons and the back arrow.
  icon: 20,
  radio: 24,
  scaleOption: 52,
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
