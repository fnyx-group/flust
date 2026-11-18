import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function ExternalIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M13 4h7v7M20 4l-9 9M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </LineIcon>
  );
}
