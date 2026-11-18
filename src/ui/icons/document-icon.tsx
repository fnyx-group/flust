import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function DocumentIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M7 3.5h7l4.5 4.5v11A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5zM13.5 3.5V8.5h5M9 13h6M9 16.5h6" />
    </LineIcon>
  );
}
