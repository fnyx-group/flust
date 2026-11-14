import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function HomeIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" />
    </LineIcon>
  );
}
