import { Circle, Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function SettingsIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <Circle cx={15} cy={7} r={2} />
      <Circle cx={9} cy={17} r={2} />
    </LineIcon>
  );
}
