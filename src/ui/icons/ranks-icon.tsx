import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function RanksIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M12 3 21 12 12 21 3 12z" />
      <Path d="M12 8.5 15.5 12 12 15.5 8.5 12z" />
    </LineIcon>
  );
}
