export type SqlValue = string | number | null;

export type Row = Readonly<Record<string, unknown>>;

export type Executor = {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  all(sql: string, params?: readonly SqlValue[]): Promise<readonly Row[]>;
};

export type Connection = Executor & {
  close(): Promise<void>;
};

export type Database = Executor & {
  transaction<T>(task: (tx: Executor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

// Every call is queued on the single connection, so a transaction never picks up a statement
// issued elsewhere while it is open. expo-sqlite's exclusive transactions are not used because
// each one opens a new connection, which SQLCipher would need to key again.
export function createDatabase(connection: Connection): Database {
  let tail: Promise<unknown> = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  }

  return {
    exec: (sql) => enqueue(() => connection.exec(sql)),
    run: (sql, params) => enqueue(() => connection.run(sql, params)),
    all: (sql, params) => enqueue(() => connection.all(sql, params)),
    transaction: (task) => enqueue(() => inTransaction(connection, task)),
    close: () => enqueue(() => connection.close()),
  };
}

async function inTransaction<T>(
  connection: Connection,
  task: (tx: Executor) => Promise<T>,
): Promise<T> {
  await connection.exec('BEGIN IMMEDIATE');
  try {
    const value = await task(connection);
    await connection.exec('COMMIT');
    return value;
  } catch (error) {
    // SQLite may already have rolled back; the task's error is the one worth reporting.
    await connection.exec('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
