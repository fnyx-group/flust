import { useLocalSearchParams } from 'expo-router';

import { NoteScreen } from '@/features/journal/note-screen';

export default function NoteRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <NoteScreen idParam={id} />;
}
