import type { RecordError } from '@/features/errors/error-recorder';

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

type ErrorUtilsLike = {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
};

type RejectionTracker = (options: {
  allRejections: boolean;
  onUnhandled: (id: number, error: unknown) => void;
  onHandled: (id: number) => void;
}) => void;

type GlobalHandlersDeps = {
  errorUtils: ErrorUtilsLike | undefined;
  rejectionTracker: RejectionTracker | undefined;
  record: RecordError;
  // How long a fatal error waits for its entry to be written before the process ends.
  waitMs: number;
};

// Marks the handler installed here. The root layout installs it when its module runs, which Fast
// Refresh repeats: wrapping our own handler again would record every error twice.
const INSTALLED = Symbol.for('flust.errorHandler');

type MarkedHandler = GlobalHandler & { [INSTALLED]?: true };

// Errors thrown outside rendering, in callbacks and timers, reach the global handler; React
// Native's own handler then ends the process for a fatal one. The entry gets a short head start,
// then the previous handler runs as before.
export function installGlobalHandlers(deps: GlobalHandlersDeps): void {
  const { errorUtils, rejectionTracker, record, waitMs } = deps;
  if (errorUtils !== undefined) {
    const previous: MarkedHandler = errorUtils.getGlobalHandler();
    if (previous[INSTALLED] === true) return;
    const handler: MarkedHandler = (error, isFatal) => {
      const recorded = record(error, { kind: isFatal ? 'fatal' : 'uncaught' });
      void Promise.race([recorded, delay(waitMs)]).then(() => previous(error, isFatal));
    };
    handler[INSTALLED] = true;
    errorUtils.setGlobalHandler(handler);
  }
  rejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, error) => void record(error, { kind: 'unhandled-rejection' }),
    onHandled: () => undefined,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
