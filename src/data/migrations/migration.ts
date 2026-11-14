import type { Executor } from '@/data/database';

export type Migration = {
  readonly version: number;
  readonly up: (tx: Executor) => Promise<void>;
};
