import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function MessageIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </LineIcon>
  );
}
