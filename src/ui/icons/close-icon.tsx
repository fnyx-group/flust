import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function CloseIcon(props: IconProps) {
  return (
    <LineIcon {...props} strokeWidth={2}>
      <Path d="M6 6l12 12M18 6 6 18" />
    </LineIcon>
  );
}
