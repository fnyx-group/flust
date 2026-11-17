import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function WaveIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M3 12c2-3.5 4-3.5 6 0s4 3.5 6 0 4-3.5 6 0" />
    </LineIcon>
  );
}
