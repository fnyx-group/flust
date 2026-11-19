import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function ShieldIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6.2L12 3.5Z" />
    </LineIcon>
  );
}
