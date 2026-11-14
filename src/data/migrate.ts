import type { Database, Executor } from '@/data/database';
import type { Migration } from '@/data/migrations/migration';

export function latestVersion(migrations: readonly Migration[]): number {
  return migrations.at(-1)?.version ?? 0;
}

export async function readUserVersion(db: Executor): Promise<number | null> {
  const rows = await db.all('PRAGMA user_version');
  const version = rows[0]?.user_version;
  return typeof version === 'number' ? version : null;
}

// Each migration commits together with its version number, so a failure leaves the database
// at the last version that fully applied.
export async function applyMigrations(
  db: Database,
  migrations: readonly Migration[],
  from: number,
): Promise<void> {
  for (const migration of migrations) {
    if (migration.version <= from) continue;
    await db.transaction(async (tx) => {
      await migration.up(tx);
      await tx.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
