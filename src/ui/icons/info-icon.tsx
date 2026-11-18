import { Circle, Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function InfoIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 11v5.5M12 7.6v.2" />
    </LineIcon>
  );
}
