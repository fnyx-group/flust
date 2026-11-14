import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function MinusIcon(props: IconProps) {
  return (
    <LineIcon {...props} strokeWidth={2}>
      <Path d="M5 12h14" />
    </LineIcon>
  );
}
