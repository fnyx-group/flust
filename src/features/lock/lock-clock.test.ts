import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

import { MS_PER_MINUTE } from '@/domain/time';
import type { ElapsedClockDeps } from '@/features/clock/elapsed-clock';
import type { AppActivity } from '@/features/clock/minute-clock';
import { nativeElapsedClockDeps } from '@/features/clock/native-clock';
import { lockClockDeps } from '@/features/lock/lock-clock';
import { createLockController } from '@/features/lock/lock-controller';

// Named mock* so that jest.mock may read it.
let mockContinuous = 0;

jest.mock('@/features/shared/flust-privacy', () => ({
  flustPrivacy: { elapsedMs: () => mockContinuous },
}));

// The phone sleeps for ten minutes: the clock behind performance.now() stands still, the
// continuous one runs, and the date is moved back an hour meanwhile.
function sleepThenMoveDateBack(deps: ElapsedClockDeps) {
  let wall = Date.UTC(2026, 2, 2, 9);
  const uptime = 5_000;
  jest.spyOn(Date, 'now').mockImplementation(() => wall);
  jest.spyOn(performance, 'now').mockImplementation(() => uptime);
  const listeners: ((activity: AppActivity) => void)[] = [];
  const controller = createLockController(
    { settings: { enabled: true, delay: MS_PER_MINUTE }, locked: false },
    {
      ...deps,
      watchActivity: (next) => {
        listeners.push(next);
        return () => undefined;
      },
    },
  );
  controller.start();
  for (const listener of listeners) listener('background');
  mockContinuous += 10 * MS_PER_MINUTE;
  wall -= 60 * MS_PER_MINUTE;
  for (const listener of listeners) listener('foreground');
  return controller.status();
}

// The clock argument of every createLockController call in the lock gate.
function lockGateClocks(): string[] {
  const file = path.join(__dirname, 'lock-gate.tsx');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
  const clocks: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'createLockController'
    ) {
      clocks.push(node.arguments[1]?.getText(source) ?? '');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return clocks;
}

describe('lock clock', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('locks after a sleep longer than the delay, even with the date moved back', () => {
    expect(sleepThenMoveDateBack(lockClockDeps)).toBe('locked');
  });

  it('is needed: the clock that stops during sleep would open the app', () => {
    expect(sleepThenMoveDateBack(nativeElapsedClockDeps)).toBe('unlocked');
  });

  it('is the one the lock gate gives the lock controller', () => {
    const gate = fs.readFileSync(path.join(__dirname, 'lock-gate.tsx'), 'utf8');

    expect(gate).toContain("import { lockClockDeps } from '@/features/lock/lock-clock';");
    expect(lockGateClocks()).toEqual(['lockClockDeps']);
  });
});
