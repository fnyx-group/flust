import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function ForwardIcon(props: IconProps) {
  return (
    <LineIcon {...props} strokeWidth={2}>
      <Path d="M9 5l7 7-7 7" />
    </LineIcon>
  );
}
