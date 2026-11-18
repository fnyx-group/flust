import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function CheckIcon(props: IconProps) {
  return (
    <LineIcon {...props} strokeWidth={2.2}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </LineIcon>
  );
}
