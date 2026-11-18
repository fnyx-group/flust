import { Circle, Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function ClockIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" />
    </LineIcon>
  );
}
