import { expoFiles } from '@/data/native/expo-files';

const mockPresent = new Set<string>();
const mockDeleted: string[] = [];

jest.mock('expo-sqlite', () => ({ defaultDatabaseDirectory: '/data/SQLite' }));
jest.mock('expo-file-system', () => ({
  File: class {
    readonly name: string;
    constructor(_directory: string, name: string) {
      this.name = name;
    }
    get exists() {
      return mockPresent.has(this.name);
    }
    delete() {
      mockPresent.delete(this.name);
      mockDeleted.push(this.name);
    }
  },
}));

beforeEach(() => {
  mockPresent.clear();
  mockDeleted.length = 0;
});

describe('expo files', () => {
  it('removes the side files before the database', async () => {
    for (const name of ['flust.db', 'flust.db-journal', 'flust.db-wal', 'flust.db-shm']) {
      mockPresent.add(name);
    }

    await expoFiles.remove('flust.db');

    expect(mockDeleted).toEqual(['flust.db-journal', 'flust.db-wal', 'flust.db-shm', 'flust.db']);
  });

  it('removes side files left without their database', async () => {
    mockPresent.add('flust.db-journal');

    await expoFiles.remove('flust.db');

    expect(mockDeleted).toEqual(['flust.db-journal']);
  });
});
