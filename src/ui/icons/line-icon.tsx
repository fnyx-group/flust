import type { ReactNode } from 'react';
import Svg from 'react-native-svg';

export type IconProps = {
  color: string;
  size?: number;
};

type LineIconProps = IconProps & { children: ReactNode; strokeWidth?: number };

export function LineIcon({ color, size = 24, strokeWidth = 1.8, children }: LineIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}
