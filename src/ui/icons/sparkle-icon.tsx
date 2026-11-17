import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function SparkleIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" />
    </LineIcon>
  );
}
