import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function PhoneIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />
    </LineIcon>
  );
}
