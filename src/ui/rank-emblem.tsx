import type { ReactNode } from 'react';
import Svg, { Circle, G, Line, Polygon, Rect } from 'react-native-svg';

import type { Rank } from '@/domain/ranks';
import { colors, sizes } from '@/ui/theme';

type RankEmblemProps = {
  circle: Rank['circle'];
  tier: Rank['tier'];
  unlocked: boolean;
  size?: number;
};

const VIEW_BOX = 48;
const CENTER = VIEW_BOX / 2;
const RADIUS = 21;
const STROKE = 2.5;
const DOT_RADIUS = 3.5;
const INNER_OUTLINE_SCALE = 0.5;
const INNER_FILL_SCALE = 0.45;
const SPOKE_WIDTH = 1.5;

type ShapeProps = { scale: number; fill: string };

// Outer shapes per circle, from docs/product/ranks.md. Each is drawn at a scale of RADIUS so that
// the same shape, smaller, serves as the inner outline and the filled inner shape.
const SHAPES: Record<Rank['circle'], (props: ShapeProps) => ReactNode> = {
  1: ({ scale, fill }) => <Circle cx={CENTER} cy={CENTER} r={RADIUS * scale} fill={fill} />,
  2: ({ scale, fill }) => <Polygon points={polygonPoints(4, RADIUS * scale)} fill={fill} />,
  3: ({ scale, fill }) => <Polygon points={polygonPoints(6, RADIUS * scale)} fill={fill} />,
  4: ({ scale, fill }) => {
    const half = (RADIUS * scale) / Math.SQRT2;
    return (
      <G fill={fill}>
        <Rect x={CENTER - half} y={CENTER - half} width={half * 2} height={half * 2} />
        <Polygon points={polygonPoints(4, RADIUS * scale)} />
      </G>
    );
  },
  5: ({ scale, fill }) =>
    scale < 1 ? (
      <Circle cx={CENTER} cy={CENTER} r={RADIUS * scale} fill={fill} />
    ) : (
      <G fill={fill}>
        <Circle cx={CENTER} cy={CENTER} r={RADIUS * 0.62} />
        <Circle cx={CENTER} cy={CENTER} r={RADIUS * 0.48} />
        {SUN_RAYS.map((angle) => (
          <SpokeLine key={angle} angle={angle} from={RADIUS * 0.76} to={RADIUS} />
        ))}
      </G>
    ),
};

const SUN_RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

// Where the spokes of the third rank of each circle meet the outer shape: its vertices, or the
// four axes for round shapes.
const SPOKES: Record<Rank['circle'], { angles: readonly number[]; to: number }> = {
  1: { angles: [0, 90, 180, 270], to: RADIUS },
  2: { angles: [0, 90, 180, 270], to: RADIUS },
  3: { angles: [-90, -30, 30, 90, 150, 210], to: RADIUS },
  4: { angles: SUN_RAYS, to: RADIUS },
  5: { angles: SUN_RAYS, to: RADIUS * 0.48 },
};

export function RankEmblem({ circle, tier, unlocked, size = sizes.emblem }: RankEmblemProps) {
  const color = unlocked ? colors.accent : colors.locked;
  const Shape = SHAPES[circle];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
      stroke={color}
      strokeWidth={STROKE}
      strokeLinejoin="round"
      accessible={false}
    >
      <Shape scale={1} fill="none" />
      {tier < 3 && <Circle cx={CENTER} cy={CENTER} r={DOT_RADIUS} fill={color} stroke="none" />}
      {tier === 2 && <Shape scale={INNER_OUTLINE_SCALE} fill="none" />}
      {tier === 3 && (
        <G strokeWidth={SPOKE_WIDTH}>
          {SPOKES[circle].angles.map((angle) => (
            <SpokeLine
              key={angle}
              angle={angle}
              from={RADIUS * INNER_FILL_SCALE}
              to={SPOKES[circle].to}
            />
          ))}
          <Shape scale={INNER_FILL_SCALE} fill={color} />
        </G>
      )}
    </Svg>
  );
}

function SpokeLine({ angle, from, to }: { angle: number; from: number; to: number }) {
  const start = pointAt(angle, from);
  const end = pointAt(angle, to);
  return <Line x1={start.x} y1={start.y} x2={end.x} y2={end.y} strokeLinecap="round" />;
}

// Vertices start at the top, so a square stands on a point as a diamond.
function polygonPoints(sides: number, radius: number): string {
  return Array.from({ length: sides }, (_, index) => {
    const { x, y } = pointAt(-90 + (360 / sides) * index, radius);
    return `${x},${y}`;
  }).join(' ');
}

function pointAt(angleDegrees: number, radius: number): { x: number; y: number } {
  const angle = (angleDegrees * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}
