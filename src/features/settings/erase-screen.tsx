import { useGoBack } from '@/features/navigation/use-go-back';
import { EraseView } from '@/features/settings/erase-view';
import { useEraseAll } from '@/features/storage/storage-context';

export function EraseScreen() {
  const goBack = useGoBack('/settings');
  const eraseAll = useEraseAll();
  return <EraseView onBack={goBack} onErase={eraseAll} />;
}
