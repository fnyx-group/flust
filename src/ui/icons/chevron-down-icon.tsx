import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function ChevronDownIcon(props: IconProps) {
  return (
    <LineIcon {...props} strokeWidth={2}>
      <Path d="M6 9l6 6 6-6" />
    </LineIcon>
  );
}
