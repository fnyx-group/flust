import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function PencilIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M15.5 5.5l3 3M4 20l1-4 11.3-11.3a2.1 2.1 0 0 1 3 3L8 19l-4 1z" />
    </LineIcon>
  );
}
