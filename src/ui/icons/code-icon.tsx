import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function CodeIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
    </LineIcon>
  );
}
