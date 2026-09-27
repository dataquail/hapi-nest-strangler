# ADR-0007: Unit of work, nested savepoints, and one domain event bus

- Status: Accepted
- Date: 2026-04-24
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033); slug was `unit-of-work-and-synchronous-event-bus`

## Context and Problem Statement

A domain event published by one aggregate can require a write to another: creating an organization emits `OrganizationCreated`; the wallet module subscribes and creates a wallet. Two aggregates, two writes, one logical operation. When do those writes commit, and what happens when one fails?

- **Immediately consistent.** Both writes participate in the same transaction; either both commit or both roll back.
- **Eventually consistent.** The first write commits, and a reaction performs the second write afterward, in its own transaction, never able to undo the trigger.

This codebase needs **both**, and the subscription — not the publisher — must choose (ADR-0022: the publisher usually may not know who is listening).

Two hazards shape the design. If the bus delivers by fan-out on another async context (`@nestjs/cqrs`'s `EventBus.publish`, which is fire-and-forget over RxJS), a subscriber's repository call uses a fresh pool connection _outside_ the publisher's transaction: eventual consistency by accident, with none of its durability. And the transaction is a property of the whole use case, so it should be declared once, visibly, at the boundary, and be re-entrant so a nested unit of work (auth's sign-in firing the user module's create command) can be caught without aborting the outer one.

## Decision

Two collaborating services — `UnitOfWork` and a single `DomainEventBus` — from two framework-free workspace packages, `@org/unit-of-work` and `@org/event-bus`. **The bus offers both consistency models, and a subscription chooses between them.** What the application supplies is a `TransactionDriver` (`platform/database/transaction-driver.ts`): open a scope, open a nested scope, say whether one is open — three lines over slonik's depth-aware `withTransaction`. It is the one file that knows a unit of work is a database transaction, and `CqrsRuntimeModule` builds the runtime once from it.

### `UnitOfWork.run` is the boundary, declared once per handler

```ts
public execute({ payload }: CreateUserCommand): Promise<CreateUserResult> {
  return this.unitOfWork.run<CreateUserResult>(async () => {
    const { user, events } = UserRootOps.create({ ... });
    const inserted = await this.users.insertOne(user);
    if (inserted.isErr()) return inserted;
    await this.events.dispatch(events);
    return Ok(user.id);
  });
}
```

`run` opens a transaction, stores its connection in an `AsyncLocalStorage` scope, and runs the function. The `@org/database` client resolves that connection before every statement and falls back to the pool when there is none, so repository calls and query-handler reads join it automatically — a policy query resolved during a command's authorization sees that command's uncommitted state without opting in.

**A typed failure discards the unit of work.** If the function resolves to an `oxide.ts` `Result` that is `Err`, the scope rolls back and the `Err` is returned unchanged. A thrown error rolls back and rethrows. This is the Promise-world equivalent of a failure channel aborting the transaction, and it is why a handler returns its `Err`s rather than throwing them (ADR-0004). The error channel names `TransactionFailed` for the boundary itself failing (a constraint violation nobody translated), which is a defect; a use case still sees only `PersistenceUnavailable`.

`run` is named `run` on a token called `UnitOfWork`, deliberately not `transactional`: "transactional" leaks the implementation the abstraction exists to hide. It lives only in `commands/` and `platform/`, never in `domain/`.

A pass-through boundary, `PassThroughUnitOfWork` from `@org/unit-of-work/testing`, is the real `run` over an in-memory driver: no transaction, but the same re-entrancy, the same after-commit ordering and the same discard-on-`Err`. Fake repositories never touch the client, so a use case unit-tests without a database and still sees production's delivery semantics.

### Nested savepoints

`run` is re-entrant. A bare call opens a transaction; a call already inside one opens a real **savepoint** (slonik's nested `transaction`). A nested failure the caller **catches** rolls back only to the savepoint; an uncaught one propagates and rolls the whole thing back.

### One bus; the subscription picks the consistency model

`dispatch` says only that the events happened, and each subscriber declares what it needs:

| surface                | when                                                 | transaction              | a handler's failure      |
| ---------------------- | ---------------------------------------------------- | ------------------------ | ------------------------ |
| `subscribe`            | in the publisher's async context, registration order | inherits the publisher's | rolls the publisher back |
| `subscribeAfterCommit` | once the outermost unit of work commits              | a fresh one per handler  | logged and isolated      |
| `stream`               | same as after-commit, but never awaited              | none                     | reported; see sagas      |

`dispatch(events)` hands the events to the ambient `DeferralSink` **first** — the unit of work installed it, and it throws `EventDispatchedOutsideUnitOfWork` when no scope is open, so a forgotten `run` fails while the dispatch is still whole — then runs the immediate handlers in the publisher's async context. Because they run there, they inherit its transaction connection: a subscriber's write joins the publisher's transaction and its rejection propagates out of `dispatch`, up through `run`, and rolls it back. The **outermost** `run` drains what it holds **after** its transaction commits, each after-commit handler through its own `run`, so each gets a fresh transaction with its failure isolated; a rolled-back transaction discards the buffer, and a rolled-back savepoint truncates it back to entry length.

Subscriptions are declared in `interface/events/*.event-adapter.ts` — `@Injectable()` classes that subscribe in `onModuleInit` (Nest guarantees every provider is constructed before the app starts serving, so a subscription cannot miss the first commit after boot). Default new cross-aggregate reactions to `subscribeAfterCommit`; reserve `subscribe` for the case where the reaction genuinely must be able to abort its trigger.

### Failure-semantics asymmetry

A **`subscribe`** handler's failure rolls the publisher back — partial success is the bug class that surface prevents. A **`subscribeAfterCommit`** handler's failure is isolated; the producer already committed. That isolation leaves the failure nowhere to surface, so it is logged _and_ reported to `UnhandledFailures` (the `platform/ddd/unhandled-failures.ts` token), the programmatic record a test can assert against and an operator can alert on.

### Process managers over after-commit events

A saga correlates several events over time and compensates when a later step fails. It consumes `stream(tags)` — published to and not awaited, on no publisher's transaction — so it trades atomicity for compensation, which is what sagas exist to do. `sagas/` is declared in the taxonomy and holds no saga; reach for an adapter first. Delivery is in-memory and lossy across a restart, the same boundary after-commit delivery has.

### Why not `@nestjs/cqrs`'s `EventBus`

Nest ships an `EventBus`, `@EventsHandler` and `@Saga`. Its `publish` pushes onto an RxJS subject and returns; handlers run on a different tick with no access to the publisher's `AsyncLocalStorage` scope and no way to fail the publisher. That is `subscribeAfterCommit` semantics without the "after commit" — it can neither join the transaction nor wait for it. The manifest refuses `EventBus`, `EventsHandler`, `Saga` and `ofType` from `@nestjs/cqrs` everywhere, so a contributor reaching for the familiar import gets the reason in the message.

## Anti-corruption layer for cross-module event consumption

A cross-aggregate reaction is an **inbound adapter** at `interface/events/<publisher>.event-adapter.ts`, the only place in a consumer module permitted to read a foreign event — through its own `<feature>.imports.ts`. It subscribes, translates, and **dispatches one of its own module's commands**; it is bus-only:

```ts
@Injectable()
export class OrganizationEventAdapter implements OnModuleInit {
  constructor(
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
  ) {}

  public onModuleInit(): void {
    // `subscribe`, not `subscribeAfterCommit`: a wallet must exist iff its organization does.
    this.events.subscribe(organizationAccessDomainEvents.OrganizationCreated, async (event) => {
      const result = await this.commandBus.execute(
        new CreateWalletCommand({ organizationId: event.organizationId }),
      );
      if (result.isErr()) throw new Error(`CreateWalletCommand failed: ${result.unwrapErr()._tag}`);
    });
  }
}
```

A `subscribe` handler rejects to fail the publisher, so an `Err` the adapter cannot absorb is thrown. Because the adapter runs in the publisher's context, the command it dispatches runs its own `run` as a nested savepoint: both commit or both roll back. A `subscribeAfterCommit` reaction runs post-commit in its own transaction — how an invitation email is sent, so a mail-server outage cannot fail the invite and a rolled-back transaction cannot produce a live accept link.

## Consequences

- Multi-aggregate writes triggered by immediate events are atomic; eventual consistency is expressible; the boundary reads at the use-case level (`return this.unitOfWork.run(...)`).
- A forgotten `run` is caught at dispatch (a thrown defect).
- Use-case unit tests don't need a database.
- The in-memory drain is lossy on a commit-then-crash; the transactional outbox remains the deferred durable follow-up, and idempotent handlers remain an expectation rather than a mechanism.
- An `Err` returned from inside `run` is the rollback signal, so a handler must return it, not swallow it into an `Ok`.

## Supersedes / differs from the Effect edition

`withUnitOfWork` combinator → `this.unitOfWork.run<XResult>(...)`; the failure channel → an `Err` return; `Layer.effectDiscard` adapters → `@Injectable() OnModuleInit`; `Effect.forkDetach` → a void promise; the two `@effect-server-utils` packages → `@org/event-bus` and `@org/unit-of-work`, written from scratch with the same three delivery contracts and the same `DeferralSink` seam. `Middleware.deadline` and fiber interruption are not ported.

## Alternatives considered

- **`@nestjs/cqrs`'s `EventBus` and `@Saga`.** Rejected; see above.
- **Two buses, the publisher choosing.** Rejected — puts the consistency decision on the party that must not know its consumers.
- **Positional dispatch (dispatch after `run`).** Rejected — a reaction's failure becomes the failure of a command whose write already committed, and "after commit" becomes a property of line order.
- **Nest interceptors/decorators (`@Transactional()`) opening the transaction.** Rejected — the boundary belongs in the handler where the reader can see it, and a decorator cannot express the `Err`-rolls-back rule.
- **Flatten nested runs into the parent transaction.** Rejected — cannot express a recoverable sub-operation.
- **Transactional outbox from day one.** Rejected as premature.

## Related

- ADR-0003 (events as values), ADR-0005 (the client's per-statement connection lookup), ADR-0009 (the pass-through unit of work, recording bus, and the integration tests that exercise savepoints and post-commit drain).
