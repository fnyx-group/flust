import { Path } from 'react-native-svg';

import { LineIcon, type IconProps } from './line-icon';

export function JournalIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <Path d="M6 3.5h11.5a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1.5 1.5 0 0 1-1.5-1.5v-14A1.5 1.5 0 0 1 6 3.5z" />
      <Path d="M9 8h6M9 12h6" />
    </LineIcon>
  );
}
