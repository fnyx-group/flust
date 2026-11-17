import { useId, type ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Polygon, Rect } from 'react-native-svg';

import type { Rank } from '@/domain/ranks';
import { circleColors, colors, sizes } from '@/ui/theme';

type RankEmblemProps = {
  circle: Rank['circle'];
  tier: Rank['tier'];
  unlocked: boolean;
  size?: number;
};

const VIEW_BOX = 48;
const CENTER = VIEW_BOX / 2;
const RADIUS = 22;
const STROKE = 2;
const DOT_RADIUS = 3.5;
const INNER_OUTLINE_SCALE = 0.55;
const INNER_FILL_SCALE = 0.5;
const INNER_STROKE = 2.5;
// The lit facet at the top left and the shaded one at the bottom right.
const LIGHT_OPACITY = 0.3;
const SHADE_OPACITY = 0.22;
const SUN_POINTS = 12;
const SUN_INNER_SCALE = 0.84;

type ShapeProps = { scale: number; fill: string; stroke?: string; strokeWidth?: number };

// Outer shapes per circle, from docs/product/ranks.md. Each is drawn at a scale of RADIUS so that
// the same shape, smaller, serves as the inner outline and the filled inner shape.
const SHAPES: Record<Rank['circle'], (props: ShapeProps) => ReactNode> = {
  1: ({ scale, ...paint }) => <Circle cx={CENTER} cy={CENTER} r={RADIUS * scale} {...paint} />,
  2: ({ scale, ...paint }) => <Polygon points={polygonPoints(4, RADIUS * scale)} {...paint} />,
  3: ({ scale, ...paint }) => <Polygon points={polygonPoints(6, RADIUS * scale)} {...paint} />,
  4: ({ scale, ...paint }) => <Polygon points={starPoints(8, RADIUS * scale, 0.78)} {...paint} />,
  5: ({ scale, ...paint }) =>
    scale < 1 ? (
      <Circle cx={CENTER} cy={CENTER} r={RADIUS * scale * 0.8} {...paint} />
    ) : (
      <Polygon points={starPoints(SUN_POINTS, RADIUS, SUN_INNER_SCALE)} {...paint} />
    ),
};

// Unlocked, the emblem is a solid shape in its circle's color, lit from the top left; locked, an
// outline of the same shape in the locked color. The inner design names the rank in its circle.
export function RankEmblem({ circle, tier, unlocked, size = sizes.emblem }: RankEmblemProps) {
  const clipId = `emblem${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const Shape = SHAPES[circle];
  const color = unlocked ? circleColors[circle] : colors.locked;
  const body = unlocked ? color : colors.lockedFill;
  // Inside an unlocked emblem the details are cut out in the background color.
  const detail = unlocked ? colors.background : colors.locked;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
      strokeLinejoin="round"
      accessible={false}
    >
      <Defs>
        <ClipPath id={clipId}>
          <Shape scale={1} fill={colors.text} />
        </ClipPath>
      </Defs>
      <Shape
        scale={1}
        fill={body}
        stroke={unlocked ? undefined : color}
        strokeWidth={unlocked ? undefined : STROKE}
      />
      {unlocked && (
        <G clipPath={`url(#${clipId})`}>
          <Rect
            x={0}
            y={0}
            width={CENTER}
            height={CENTER}
            fill={colors.text}
            opacity={LIGHT_OPACITY}
          />
          <Rect
            x={CENTER}
            y={CENTER}
            width={CENTER}
            height={CENTER}
            fill={colors.background}
            opacity={SHADE_OPACITY}
          />
        </G>
      )}
      {tier === 2 && (
        <Shape scale={INNER_OUTLINE_SCALE} fill="none" stroke={detail} strokeWidth={INNER_STROKE} />
      )}
      {tier === 3 && <Shape scale={INNER_FILL_SCALE} fill={detail} />}
      <Circle cx={CENTER} cy={CENTER} r={DOT_RADIUS} fill={tier === 3 ? body : detail} />
    </Svg>
  );
}

// Vertices start at the top, so a square stands on a point as a diamond.
function polygonPoints(sides: number, radius: number): string {
  return Array.from({ length: sides }, (_, index) => {
    const { x, y } = pointAt(-90 + (360 / sides) * index, radius);
    return `${x},${y}`;
  }).join(' ');
}

// A star of `points` tips, its notches at innerScale of the radius.
function starPoints(points: number, radius: number, innerScale: number): string {
  return Array.from({ length: points * 2 }, (_, index) => {
    const { x, y } = pointAt(
      -90 + (180 / points) * index,
      index % 2 === 0 ? radius : radius * innerScale,
    );
    return `${x},${y}`;
  }).join(' ');
}

function pointAt(angleDegrees: number, radius: number): { x: number; y: number } {
  const angle = (angleDegrees * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}
