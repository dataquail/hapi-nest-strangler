import { type EventBus, makeEventBus } from "@org/event-bus";

import type { PersistenceUnavailable } from "./persistence-unavailable.js";
import type { TransactionDriver, TransactionFailed } from "./transaction-driver.js";
import { makeUnitOfWork, type UnitOfWork, type UnitOfWorkRuntime } from "./unit-of-work.js";

/** Which kind of scope the unit of work asked a driver for. */
export type RecordedScope = "transaction" | "savepoint";

/**
 * A driver that opens no real scope but reports one active for the duration of
 * the function it wraps, and records which kind it was asked for. The depth is a
 * counter rather than a flag, so a scope closing does not report the enclosing
 * one closed too; that is what `run` reads to decide whether to nest.
 */
export const makeRecordingDriver = (): {
  readonly driver: TransactionDriver;
  readonly scopes: () => ReadonlyArray<RecordedScope>;
} => {
  const scopes: Array<RecordedScope> = [];
  let depth = 0;
  const enter =
    (scope: RecordedScope) =>
    async <A>(fn: () => Promise<A>): Promise<A> => {
      scopes.push(scope);
      depth += 1;
      try {
        return await fn();
      } finally {
        depth -= 1;
      }
    };
  return {
    driver: {
      withTransaction: enter("transaction"),
      withSavepoint: enter("savepoint"),
      isActive: () => depth > 0,
    },
    scopes: () => [...scopes],
  };
};

/** A driver whose scope always fails the way a host adapter would report it. */
export const driverFailingWith = (
  error: TransactionFailed | PersistenceUnavailable,
): TransactionDriver => ({
  withTransaction: () => Promise.reject(error),
  withSavepoint: () => Promise.reject(error),
  isActive: () => false,
});

/**
 * The whole boundary over the in-memory driver: real re-entrancy, real
 * after-commit ordering, real discard-on-rollback, no datastore. What a unit
 * test of a use case wires when its repositories are fakes that never consult a
 * transaction. The bus it drains is the one passed in (or a fresh one).
 */
export const makePassThroughUnitOfWork = (
  eventBus: EventBus = makeEventBus(),
): UnitOfWorkRuntime & { readonly eventBus: EventBus } => {
  const { driver } = makeRecordingDriver();
  const runtime = makeUnitOfWork({ driver, eventBus });
  return { ...runtime, eventBus };
};

/** A pass-through boundary whose sink is bound to nothing a test inspects. */
export const PassThroughUnitOfWork: UnitOfWork = makePassThroughUnitOfWork().unitOfWork;
