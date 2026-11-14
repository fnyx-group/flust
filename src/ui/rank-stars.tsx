import Svg, { Polygon } from 'react-native-svg';

import type { Rank } from '@/domain/ranks';
import { sizes, spacing } from '@/ui/theme';

type RankStarsProps = {
  // One star per circle number: rarity grows with the circle.
  circle: Rank['circle'];
  color: string;
  size?: number;
};

const VIEW_BOX = 24;
const STAR_POINTS = starPoints(VIEW_BOX / 2, VIEW_BOX / 2, VIEW_BOX * 0.42);

// Decorative: the circle is part of the label read by screen readers.
export function RankStars({ circle, color, size = sizes.starSmall }: RankStarsProps) {
  const gap = size >= sizes.starLarge ? spacing.s : spacing.xs;
  const width = circle * size + (circle - 1) * gap;
  const scale = VIEW_BOX / size;
  return (
    <Svg
      width={width}
      height={size}
      viewBox={`0 0 ${width * scale} ${VIEW_BOX}`}
      fill={color}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: circle }, (_, index) => (
        <Polygon
          key={index}
          points={STAR_POINTS}
          transform={`translate(${index * (size + gap) * scale} 0)`}
        />
      ))}
    </Svg>
  );
}

function starPoints(cx: number, cy: number, outer: number): string {
  const inner = outer * 0.45;
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = ((-90 + index * 36) * Math.PI) / 180;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(' ');
}
