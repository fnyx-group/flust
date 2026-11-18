import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function HeartIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
    </LineIcon>
  );
}
