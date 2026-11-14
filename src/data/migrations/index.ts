import { initial } from '@/data/migrations/0001-initial';
import { onboarding } from '@/data/migrations/0002-onboarding';
import type { Migration } from '@/data/migrations/migration';

// Append only. A released migration is never edited: devices have already applied it.
export const MIGRATIONS: readonly Migration[] = [initial, onboarding];
