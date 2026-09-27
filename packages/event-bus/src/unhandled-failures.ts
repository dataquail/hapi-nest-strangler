export type UnhandledFailure = {
  readonly source: string;
  readonly kind: "after-commit-handler" | "saga";
  readonly eventTag: string;
  readonly cause: unknown;
};

/**
 * Where a failure goes when no caller is left to receive it: an after-commit
 * handler fails long after the dispatching request finished. A log line is
 * something nothing can alert on; this is the programmatic record.
 */
export type UnhandledFailures = {
  readonly report: (failure: UnhandledFailure) => void;
  readonly failures: () => ReadonlyArray<UnhandledFailure>;
};

export type UnhandledFailuresOptions = {
  readonly log?: (failure: UnhandledFailure) => void;
};

const logToStderr = (failure: UnhandledFailure): void => {
  process.stderr.write(
    `[event-bus] unhandled ${failure.kind} failure at ${failure.source} for ${failure.eventTag}: ${String(failure.cause)}\n`,
  );
};

export const makeUnhandledFailures = (
  options: UnhandledFailuresOptions = {},
): UnhandledFailures => {
  const log = options.log ?? logToStderr;
  const recorded: Array<UnhandledFailure> = [];
  return {
    report: (failure) => {
      recorded.push(failure);
      log(failure);
    },
    failures: () => [...recorded],
  };
};
