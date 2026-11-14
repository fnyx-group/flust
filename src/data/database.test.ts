import { DatabaseSync } from 'node:sqlite';

import { createDatabase, type Connection, type Row, type SqlValue } from '@/data/database';

function memoryConnection(): Connection & { log: string[] } {
  const db = new DatabaseSync(':memory:');
  const log: string[] = [];
  return {
    log,
    async exec(sql) {
      log.push(sql);
      db.exec(sql);
    },
    async run(sql, params = []) {
      log.push(sql);
      db.prepare(sql).run(...(params as SqlValue[]));
    },
    async all(sql, params = []) {
      log.push(sql);
      return db.prepare(sql).all(...(params as SqlValue[])) as Row[];
    },
    async close() {
      db.close();
    },
  };
}

async function setUp() {
  const connection = memoryConnection();
  const db = createDatabase(connection);
  await db.exec('CREATE TABLE item (value INTEGER NOT NULL) STRICT');
  return { connection, db };
}

async function values(db: ReturnType<typeof createDatabase>) {
  return (await db.all('SELECT value FROM item ORDER BY value')).map((row) => row.value);
}

describe('createDatabase', () => {
  it('commits a transaction that succeeds', async () => {
    const { db } = await setUp();

    const result = await db.transaction(async (tx) => {
      await tx.run('INSERT INTO item (value) VALUES (?)', [1]);
      await tx.run('INSERT INTO item (value) VALUES (?)', [2]);
      return 'done';
    });

    expect(result).toBe('done');
    expect(await values(db)).toEqual([1, 2]);
  });

  it('rolls back every write of a transaction that fails', async () => {
    const { db } = await setUp();

    const failing = db.transaction(async (tx) => {
      await tx.run('INSERT INTO item (value) VALUES (?)', [1]);
      throw new Error('interrupted');
    });

    await expect(failing).rejects.toThrow('interrupted');
    expect(await values(db)).toEqual([]);
  });

  it('reports the original error when SQLite has already rolled back', async () => {
    const { db } = await setUp();

    const failing = db.transaction(async (tx) => {
      await tx.exec('ROLLBACK');
      throw new Error('original');
    });

    await expect(failing).rejects.toThrow('original');
  });

  it('keeps statements issued during a transaction out of it', async () => {
    const { connection, db } = await setUp();

    const transaction = db.transaction(async (tx) => {
      await tx.run('INSERT INTO item (value) VALUES (?)', [1]);
      await new Promise((resolve) => setTimeout(resolve, 0));
      throw new Error('interrupted');
    });
    const outside = db.run('INSERT INTO item (value) VALUES (?)', [2]);

    await expect(transaction).rejects.toThrow('interrupted');
    await outside;
    expect(await values(db)).toEqual([2]);
    expect(connection.log.indexOf('ROLLBACK')).toBeLessThan(
      connection.log.lastIndexOf('INSERT INTO item (value) VALUES (?)'),
    );
  });

  it('keeps working after a failed statement', async () => {
    const { db } = await setUp();

    await expect(db.exec('NOT SQL')).rejects.toThrow();
    await db.run('INSERT INTO item (value) VALUES (?)', [3]);

    expect(await values(db)).toEqual([3]);
  });
});
