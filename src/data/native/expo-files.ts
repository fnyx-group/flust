import { File } from 'expo-file-system';
import { defaultDatabaseDirectory } from 'expo-sqlite';

import type { DatabaseFiles } from '@/data/storage-deps';

const JOURNAL_SUFFIXES = ['', '-journal', '-wal', '-shm'];

export const expoFiles: DatabaseFiles = {
  async exists(name) {
    return databaseFile(name).exists;
  },
  async copy(from, to) {
    await databaseFile(from).copy(databaseFile(to), { overwrite: true });
  },
  async move(from, to) {
    await databaseFile(from).move(databaseFile(to), { overwrite: true });
  },
  async remove(name) {
    for (const suffix of JOURNAL_SUFFIXES) {
      const file = databaseFile(`${name}${suffix}`);
      if (file.exists) file.delete();
    }
  },
};

// expo-sqlite exposes its directory as a plain path, while expo-file-system expects a URI.
function databaseFile(name: string): File {
  const directory = String(defaultDatabaseDirectory);
  const uri = directory.startsWith('file://') ? directory : `file://${directory}`;
  return new File(uri, name);
}
