import type { Database } from '@/data/database';
import { insertJourney } from '@/data/journey-repository';
import type { Journey } from '@/domain/journey';

// Writes a journey straight to the database, as the onboarding does, through a second connection.
export async function seedJourney(
  fake: { rawDatabase(): Promise<Database> },
  journey: Journey,
): Promise<void> {
  const raw = await fake.rawDatabase();
  await raw.transaction((tx) => insertJourney(tx, journey));
  await raw.close();
}
