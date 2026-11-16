import { router } from 'expo-router';

import { EraseView } from '@/features/settings/erase-view';
import { useEraseAll } from '@/features/storage/storage-context';

export function EraseScreen() {
  const eraseAll = useEraseAll();
  return (
    <EraseView
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      onErase={eraseAll}
    />
  );
}
