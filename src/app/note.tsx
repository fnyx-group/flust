import { useLocalSearchParams } from 'expo-router';

import { NoteScreen } from '@/features/journal/note-screen';

export { ScreenErrorBoundary as ErrorBoundary } from '@/features/errors/screen-error-boundary';

export default function NoteRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <NoteScreen idParam={id} />;
}
