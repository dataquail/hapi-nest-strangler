import { Global, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { makeEventBus, makeUnhandledFailures } from "@org/event-bus";
import { makeUnitOfWork } from "@org/unit-of-work";

import {
  billingCommandSpanAttributes,
  billingQuerySpanAttributes,
} from "@/modules/billing/billing.platform.js";
import {
  todoCommandSpanAttributes,
  todoQuerySpanAttributes,
} from "@/modules/todos/todos.platform.js";
import {
  walletCommandSpanAttributes,
  walletEventSpanAttributes,
  walletQuerySpanAttributes,
} from "@/modules/wallet/wallet.platform.js";
import { Database } from "@/platform/database/database.js";
import { makeTransactionDriver } from "@/platform/database/transaction-driver.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnhandledFailures } from "@/platform/ddd/unhandled-failures.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { AppCommandBus, CommandSpanAttributes } from "./command-bus.js";
import { AppQueryBus, QuerySpanAttributes } from "./query-bus.js";

const mergeUnique = <V>(
  name: string,
  ...maps: ReadonlyArray<Readonly<Record<string, V>>>
): Record<string, V> => {
  const merged: Record<string, V> = {};
  for (const map of maps) {
    for (const [key, value] of Object.entries(map)) {
      if (key in merged)
        throw new Error(`${name}: duplicate span-attribute extractor for "${key}"`);
      merged[key] = value;
    }
  }
  return merged;
};

// The slice both composition roots share verbatim: Nest's buses, the one
// domain event bus, the unit of work over the database, and the span
// attribute tables folded from every module's platform surface.
@Global()
@Module({
  imports: [CqrsModule.forRoot()],
  providers: [
    { provide: UnhandledFailures, useFactory: () => makeUnhandledFailures() },
    {
      provide: DomainEventBus,
      inject: [UnhandledFailures],
      useFactory: (unhandledFailures: UnhandledFailures) =>
        makeEventBus({
          unhandledFailures,
          spanAttributes: mergeUnique("event span attributes", walletEventSpanAttributes),
        }),
    },
    {
      provide: UnitOfWork,
      inject: [Database, DomainEventBus],
      useFactory: (database: Database, eventBus: DomainEventBus) =>
        makeUnitOfWork({ driver: makeTransactionDriver(database), eventBus }).unitOfWork,
    },
    {
      provide: CommandSpanAttributes,
      useFactory: () =>
        mergeUnique(
          "command span attributes",
          walletCommandSpanAttributes,
          todoCommandSpanAttributes,
          billingCommandSpanAttributes,
        ),
    },
    {
      provide: QuerySpanAttributes,
      useFactory: () =>
        mergeUnique(
          "query span attributes",
          walletQuerySpanAttributes,
          todoQuerySpanAttributes,
          billingQuerySpanAttributes,
        ),
    },
    AppCommandBus,
    AppQueryBus,
  ],
  exports: [CqrsModule, DomainEventBus, UnitOfWork, UnhandledFailures, AppCommandBus, AppQueryBus],
})
export class CqrsRuntimeModule {}
