import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function PlusIcon(props: IconProps) {
  return (
    <LineIcon {...props} strokeWidth={2}>
      <Path d="M12 5v14M5 12h14" />
    </LineIcon>
  );
}
