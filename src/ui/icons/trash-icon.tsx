import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function TrashIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6M14 10.5v6" />
    </LineIcon>
  );
}
