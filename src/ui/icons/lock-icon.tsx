import { Path, Rect } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function LockIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Rect x={5} y={10.5} width={14} height={10} rx={2} />
      <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </LineIcon>
  );
}
