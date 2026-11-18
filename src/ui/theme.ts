import type { TextStyle } from 'react-native';

import type { Rank } from '@/domain/ranks';
import type { CounterSize } from '@/domain/streak';

export const colors = {
  background: '#111116',
  surface: '#1A1A21',
  separator: '#2A2A33',
  // The outline of a locked emblem, control borders and the off switch track. Too dark for text:
  // see muted.
  locked: '#5C5B66',
  // Text that must read as dimmed, such as locked rank names, placeholders and unavailable days.
  // At least 4.5:1 on the background and on the surface, unlike locked.
  muted: '#8A8994',
  textSecondary: '#B9B8C2',
  text: '#FFFFFF',
  accent: '#7B6BFF',
  // The accent is under 4.5:1 on the surface, so violet text and labels use this lighter shade.
  accentText: '#A99EFF',
  // Cards that hold the user's own progress or plan: the rank card, the plan, the lapse hint.
  accentSurface: '#1F1C33',
  // Fill of a locked emblem, a shade above the surface.
  lockedFill: '#22222B',
  // Calm and protection: privacy, breathing, plans, listening lines, and circle I.
  teal: '#4FD1C5',
  // Moments and reminders: risk moments, the evening check-in, and circle III.
  gold: '#F2B84B',
  // Circle IV.
  coral: '#FF7A7A',
  // Destructive actions and emergency numbers only. Never on the lapse screens, the counter or
  // the ranks.
  danger: '#FF7A7A',
  onAccent: '#111116',
} as const;

// Shapes take the circle's color; text takes its readable shade, which differs only for the
// violet of circle II.
export const circleColors: Record<Rank['circle'], string> = {
  1: colors.teal,
  2: colors.accent,
  3: colors.gold,
  4: colors.coral,
  5: colors.text,
};

export const circleTextColors: Record<Rank['circle'], string> = {
  ...circleColors,
  2: colors.accentText,
};

// A color laid at an opacity over what is under it: icon tiles, selected chips, danger cards.
export function tint(color: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const tintAlpha = {
  tile: 0.16,
  chip: 0.22,
  card: 0.12,
  border: 0.5,
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
  streakUnit: { fontFamily: fonts.bold, fontSize: 20, color: colors.textSecondary },
  streakRest: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  quoteLabel: { fontFamily: fonts.bold, fontSize: 13 },
  quote: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 26 },
  welcomeTitle: { fontFamily: fonts.extraBold, fontSize: 40, lineHeight: 46 },
  brandLockup: { fontFamily: fonts.extraBold, fontSize: 36 },
  screenTitle: { fontFamily: fonts.extraBold, fontSize: 28 },
  rankName: { fontFamily: fonts.extraBold, fontSize: 22 },
  unlockRankName: { fontFamily: fonts.extraBold, fontSize: 40, lineHeight: 46 },
  unlockLabel: { fontFamily: fonts.bold, fontSize: 14 },
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
  row: { fontFamily: fonts.semiBold, fontSize: 15 },
  badgeName: { fontFamily: fonts.extraBold, fontSize: 15 },
  rankCardName: { fontFamily: fonts.extraBold, fontSize: 18 },
  helpNumber: {
    fontFamily: fonts.numberSemiBold,
    fontSize: 30,
    fontVariant: ['tabular-nums'],
  },
  body: { fontFamily: fonts.regular, fontSize: 15 },
  bodyLarge: { fontFamily: fonts.regular, fontSize: 16 },
  // Body text that can run over several lines.
  paragraph: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  paragraphSmall: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textSecondary },
  caption: { fontFamily: fonts.regular, fontSize: 12 },
  weekdayInitial: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.textSecondary },
  primaryButton: { fontFamily: fonts.extraBold, fontSize: 17 },
  secondaryButton: { fontFamily: fonts.semiBold, fontSize: 15 },
  tabLabel: { fontFamily: fonts.semiBold, fontSize: 11 },
} as const satisfies Record<string, TextStyle>;

// The number inside the streak ring, by its digits: 2 or fewer (hours always), 3, then 4 or more.
// Each keeps the widest number of its group inside the ring (labels.test.ts measures it).
const counterFontSizes: Record<CounterSize, number> = {
  large: 120,
  medium: 100,
  small: 80,
};

// The boards are drawn for a screen 390 points wide.
const BOARD_WIDTH = 390;

// The ring and its number keep the boards' size on a screen as wide as the boards or wider, and
// shrink together on a narrower one, so the number fits the ring at every width.
export function streakRingLayout(
  windowWidth: number,
  counter: CounterSize,
): { readonly ring: number; readonly fontSize: number } {
  const scale = Math.min(1, windowWidth / BOARD_WIDTH);
  return {
    ring: Math.round(sizes.streakRing * scale),
    fontSize: Math.round(counterFontSizes[counter] * scale),
  };
}

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
  // Inside the fixed size streak ring, and already the largest text on screen.
  streakCounter: 1,
  // On the 170 point disk inside the breathing ring. The phase name is a word or two and wraps
  // onto a second line on the disk; the 56 point seconds count may not grow.
  breathingPhase: 1.5,
  breathingCount: 1,
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

// The wheel rows next to the selected one: secondary text still at 4.5:1 on the background.
export const wheelNearOpacity = 0.7;

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
  iconTile: 10,
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
  rankCardEmblem: 44,
  currentRankEmblem: 64,
  gridEmblem: 36,
  unlockEmblem: 120,
  unlockRing: 196,
  currentRankOutline: 2,
  rankProgressHeight: 8,
  weekDay: 28,
  weekDayRing: 2,
  weekDayToday: 3,
  // A tinted square behind a row's icon.
  iconTile: 36,
  callButton: 40,
  breathingRing: 220,
  breathingCircle: 170,
  breathingStroke: 3,
  streakRing: 236,
  streakRingStroke: 12,
} as const;
