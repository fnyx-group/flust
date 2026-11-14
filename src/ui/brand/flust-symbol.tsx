import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '@/ui/theme';

type FlustSymbolProps = {
  height: number;
  color?: string;
};

const viewBoxWidth = 54;
const viewBoxHeight = 82;

export function FlustSymbol({ height, color = colors.accent }: FlustSymbolProps) {
  return (
    <Svg
      width={(height * viewBoxWidth) / viewBoxHeight}
      height={height}
      viewBox={`23 10 ${viewBoxWidth} ${viewBoxHeight}`}
      fill={color}
    >
      <Path d="M63 10H23A40 40 0 0 1 63 50Z" />
      <Rect x={49} y={30} width={14} height={62} />
      <Rect x={35} y={52} width={42} height={12} />
    </Svg>
  );
}
