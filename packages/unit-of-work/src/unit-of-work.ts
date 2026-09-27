import { AsyncLocalStorage } from "node:async_hooks";

import type { DeferralSink, Event, EventBus } from "@org/event-bus";
import { Result } from "oxide.ts";

import { PersistenceUnavailable } from "./persistence-unavailable.js";
import { type TransactionDriver, TransactionFailed } from "./transaction-driver.js";

/**
 * Something was deferred without a unit of work open. A defect rather than a
 * failure — no publisher declares it and none could handle it — but a tagged one,
 * so a test can name the condition instead of matching on a sentence.
 */
export class EventDispatchedOutsideUnitOfWork extends Error {
  public readonly _tag = "EventDispatchedOutsideUnitOfWork" as const;
  public readonly tags: ReadonlyArray<string>;
  constructor(props: { readonly tags: ReadonlyArray<string> }) {
    super(
      `EventBus.dispatch requires a unit of work: no scope open when dispatching ${props.tags
        .map((tag) => `'${tag}'`)
        .join(", ")} (did you forget unitOfWork.run?)`,
    );
    this.name = "EventDispatchedOutsideUnitOfWork";
    this.tags = props.tags;
  }
}

type Drain = () => Promise<void>;

type Scope = {
  readonly deferred: Array<Drain>;
};

/**
 * "Run this function inside a single unit of work" — the atomicity boundary for
 * a logical operation. Every repository write inside it commits together or is
 * discarded together, and every immediate event subscriber inherits that same
 * boundary.
 *
 * A typed failure discards the unit of work: when `fn` resolves to an
 * `oxide.ts` `Result` that is `Err`, the scope rolls back and the `Err` is
 * returned unchanged. A thrown error rolls back and rethrows.
 */
export type UnitOfWork = {
  readonly run: <A>(fn: () => Promise<A>) => Promise<A>;
};

export type UnitOfWorkRuntime = {
  readonly unitOfWork: UnitOfWork;
  readonly deferralSink: DeferralSink;
};

class RollbackWithValue {
  constructor(public readonly value: unknown) {}
}

const isTypedFailure = (value: unknown): boolean => Result.is(value) && value.isErr();

/**
 * Builds the unit of work over a host's atomicity primitive, and with it the
 * `DeferralSink` that gives `EventBus.subscribeAfterCommit` its commit. The two
 * ship together because they are one decision: what "after" means is the
 * boundary's to define. The sink is attached to the bus here, so a host wires
 * the runtime once.
 *
 * `run` is re-entrant. A bare call opens a scope; a call already inside one
 * nests instead of reaching for a second connection. Whether a nested failure is
 * fatal to the whole operation is then the caller's choice — catching it discards
 * only the nested scope, letting it propagate discards everything.
 */
export const makeUnitOfWork = (options: {
  readonly driver: TransactionDriver;
  readonly eventBus: EventBus;
}): UnitOfWorkRuntime => {
  const { driver, eventBus } = options;
  const storage = new AsyncLocalStorage<Scope>();

  const inScope = async <A>(scope: Scope, fn: () => Promise<A>): Promise<A> => {
    const value = await storage.run(scope, fn);
    if (isTypedFailure(value)) throw new RollbackWithValue(value);
    return value;
  };

  const recoverTypedFailure = <A>(cause: unknown): A => {
    if (cause instanceof RollbackWithValue) return cause.value as A;
    throw cause;
  };

  const runOutermost = async <A>(fn: () => Promise<A>): Promise<A> => {
    const scope: Scope = { deferred: [] };
    const result = await driver
      .withTransaction(() => inScope(scope, fn))
      .catch((cause: unknown) => recoverTypedFailure<A>(cause));
    if (!isTypedFailure(result)) {
      for (const drain of scope.deferred) {
        await drain();
      }
    }
    return result;
  };

  const runNested = async <A>(fn: () => Promise<A>, scope: Scope): Promise<A> => {
    const lengthOnEntry = scope.deferred.length;
    try {
      return await driver.withSavepoint(() => inScope(scope, fn));
    } catch (cause) {
      scope.deferred.length = lengthOnEntry;
      return recoverTypedFailure<A>(cause);
    }
  };

  const run = <A>(fn: () => Promise<A>): Promise<A> => {
    if (!driver.isActive()) return runOutermost(fn);
    const enclosing = storage.getStore();
    return runNested(fn, enclosing ?? { deferred: [] });
  };

  const deferralSink: DeferralSink = {
    defer: (events: ReadonlyArray<Event.Base>) => {
      const scope = storage.getStore();
      if (scope === undefined) {
        throw new EventDispatchedOutsideUnitOfWork({ tags: events.map((event) => event._tag) });
      }
      scope.deferred.push(() => eventBus.drain(events, run));
    },
  };

  eventBus.attachDeferralSink(deferralSink);

  return { unitOfWork: { run }, deferralSink };
};

export { PersistenceUnavailable, TransactionFailed };
