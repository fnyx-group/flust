import type { ErrorContext } from '@/features/errors/error-recorder';
import { installGlobalHandlers } from '@/features/errors/global-handlers';

type Handler = (error: unknown, isFatal?: boolean) => void;

function setUp(record: (error: unknown, context: ErrorContext) => Promise<void>, installs = 1) {
  const events: string[] = [];
  let handler: Handler = (_error, isFatal) => void events.push(`previous ${String(isFatal)}`);
  const errorUtils = {
    getGlobalHandler: () => handler,
    setGlobalHandler: (next: Handler) => {
      handler = next;
    },
  };
  let tracker:
    | Parameters<NonNullable<Parameters<typeof installGlobalHandlers>[0]['rejectionTracker']>>[0]
    | null = null;
  for (let install = 0; install < installs; install += 1) {
    installGlobalHandlers({
      errorUtils,
      rejectionTracker: (options) => {
        tracker = options;
      },
      record,
      waitMs: 1000,
    });
  }
  return {
    events,
    handle: (error: unknown, isFatal?: boolean) => handler(error, isFatal),
    tracker: () => tracker,
  };
}

describe('installGlobalHandlers', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('records a fatal error, then hands it to the previous handler', async () => {
    const contexts: ErrorContext[] = [];
    const { events, handle } = setUp(async (_error, context) => void contexts.push(context));

    handle(new Error('boom'), true);
    await jest.runAllTimersAsync();

    expect(contexts).toEqual([{ kind: 'fatal' }]);
    expect(events).toEqual(['previous true']);
  });

  it('records an error once when installed again, as Fast Refresh does', async () => {
    const contexts: ErrorContext[] = [];
    const { events, handle } = setUp(async (_error, context) => void contexts.push(context), 2);

    handle(new Error('boom'), true);
    await jest.runAllTimersAsync();

    expect(contexts).toEqual([{ kind: 'fatal' }]);
    expect(events).toEqual(['previous true']);
  });

  it('records an error that is not fatal as uncaught', async () => {
    const contexts: ErrorContext[] = [];
    const { handle } = setUp(async (_error, context) => void contexts.push(context));

    handle(new Error('boom'), false);
    await jest.runAllTimersAsync();

    expect(contexts).toEqual([{ kind: 'uncaught' }]);
  });

  it('hands the error on after the wait when recording takes too long', async () => {
    const { events, handle } = setUp(() => new Promise<void>(() => undefined));

    handle(new Error('boom'), true);
    await jest.advanceTimersByTimeAsync(999);
    expect(events).toEqual([]);

    await jest.advanceTimersByTimeAsync(1);
    expect(events).toEqual(['previous true']);
  });

  it('records unhandled promise rejections', () => {
    const contexts: ErrorContext[] = [];
    const { tracker } = setUp(async (_error, context) => void contexts.push(context));

    tracker()?.onUnhandled(1, new Error('rejected'));
    tracker()?.onHandled(1);

    expect(contexts).toEqual([{ kind: 'unhandled-rejection' }]);
  });

  it('does nothing without ErrorUtils or a rejection tracker', () => {
    expect(() =>
      installGlobalHandlers({
        errorUtils: undefined,
        rejectionTracker: undefined,
        record: async () => undefined,
        waitMs: 0,
      }),
    ).not.toThrow();
  });
});
