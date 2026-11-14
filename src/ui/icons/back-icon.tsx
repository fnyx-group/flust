import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function BackIcon(props: IconProps) {
  return (
    <LineIcon {...props} strokeWidth={2}>
      <Path d="M15 5l-7 7 7 7" />
    </LineIcon>
  );
}
