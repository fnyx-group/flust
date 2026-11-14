import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/ui/theme';

type ProgressRingProps = {
  // Between 0 and 1.
  fraction: number;
  size: number;
  strokeWidth: number;
  // Drawn centered inside the ring.
  children?: ReactNode;
};

// Decorative: the parent announces the progress in its own label.
export function ProgressRing({ fraction, size, strokeWidth, children }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, fraction));
  const center = size / 2;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.container, { width: size, height: size }]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.separator}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {clamped > 0 && (
          // Rotated so that progress starts at the top and runs clockwise.
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.accent}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped)}
            transform={`rotate(-90 ${center} ${center})`}
            fill="none"
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
