/**
 * The unit of work's atomicity machinery failed — a commit was rejected, a
 * savepoint could not be released. By the time an operation reaches the
 * boundary a repository has already translated its own constraint violations
 * into domain errors; what is left is the boundary itself failing, which no use
 * case can act on, so `run` throws it as a defect.
 */
export class TransactionFailed extends Error {
  public readonly _tag = "TransactionFailed" as const;
  constructor(props: { readonly message: string; readonly cause?: unknown }) {
    super(props.message, props.cause === undefined ? undefined : { cause: props.cause });
    this.name = "TransactionFailed";
  }
}

/**
 * The atomicity primitive a host supplies. An adapter is responsible for making
 * its own scope handle ambient to the function it wraps (an AsyncLocalStorage
 * the database kernel owns), so a repository inside picks it up. Nothing about
 * that handle appears here.
 *
 * `withTransaction` and `withSavepoint` commit when `fn` resolves and discard
 * when it rejects; they surface their own failure as `TransactionFailed` (the
 * commit was refused) or `PersistenceUnavailable` (the store went away).
 */
export type TransactionDriver = {
  readonly withTransaction: <A>(fn: () => Promise<A>) => Promise<A>;
  readonly withSavepoint: <A>(fn: () => Promise<A>) => Promise<A>;
  readonly isActive: () => boolean;
};
