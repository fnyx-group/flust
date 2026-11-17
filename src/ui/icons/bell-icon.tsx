import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function BellIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 21h4" />
    </LineIcon>
  );
}
