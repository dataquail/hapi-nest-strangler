# ADR-0006: Typed CommandBus / QueryBus over `@nestjs/cqrs`

- Status: Accepted
- Date: 2026-04-24
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033); slug was `typed-command-and-query-bus`

## Context and Problem Statement

CQRS architectures route commands and queries through a bus: handlers register against a message, and callers dispatch a message rather than calling the handler directly. The bus serves three purposes: decoupling, a uniform call surface for every caller that needs to invoke a use case it does not own (HTTP endpoints, CLI endpoints, event adapters, other modules' ACL adapters), and a seam for cross-cutting behavior (spans).

The traditional cost of a bus is **type erasure** — `execute(msg): Promise<unknown>`. `@nestjs/cqrs` 12 closes that gap: a message that `extends Command<R>` (or `Query<R>`) carries its result type as a phantom, and `CommandBus.execute(cmd)` returns `Promise<R>`. That is enough to keep the signature on the message and read it at the dispatch site — which is the property this ADR exists to protect.

## Decision

### A message class is the whole contract

Each command and query is one class carrying its payload and declaring its result — a `Result` whose `E` union is the message's failure channel (ADR-0004):

```ts
export type CreateUserPayload = { readonly email: string };
export type CreateUserResult = Result<UserId, UserAlreadyExists | PersistenceUnavailable>;

export class CreateUserCommand extends Command<CreateUserResult> {
  constructor(public readonly payload: CreateUserPayload) {
    super();
  }
}
```

The class identifier **is** its tag: the span the bus opens is named after `constructor.name`, and the span-attribute map is keyed by it. A handler is named for the message plus a `Handler` suffix (`CreateUserHandler`) and is a `@CommandHandler(CreateUserCommand)` class implementing `ICommandHandler<CreateUserCommand>` whose `execute` returns `Promise<CreateUserResult>`. The payload type keeps the shorter `CreateUserPayload`, and the result alias `CreateUserResult` exists because `oxide.ts` needs the union written once (ADR-0003).

A `Command<R>` cannot be dispatched on the query bus and vice versa — the base class is the side. That is the CQRS distinction the two buses exist to express, and it rests on the message itself.

### Dispatch is typed by the message, not by a registry

```ts
const result = await this.commandBus.execute(new CreateUserCommand({ email })); // Promise<CreateUserResult>
```

The signature is read off the thing being dispatched. There is no side table keyed by tag, no `declare module` block per message.

### The dispatch surface is `AppCommandBus` / `AppQueryBus`

Callers inject `AppCommandBus` and `AppQueryBus` (`platform/cqrs/`), thin `@Injectable()` wrappers over Nest's `CommandBus`/`QueryBus`. They exist for one reason: Nest's buses open no span, and the use-case span is the whole observability story (ADR-0012). The wrapper opens `command.<Name>` / `query.<Name>` around the dispatch with the attributes the owning module's extractor returns, marks the span on a thrown defect, and hands the handler's `Result` back untouched. Nothing else — no validation, no retry — lives here: cross-cutting behavior that must not change what a call site's types say is the only kind the seam admits.

### Handlers are the module's providers; the bus is global

`CqrsModule.forRoot()` is imported once, by the global `CqrsRuntimeModule`, so there is one command bus and one query bus. Each feature module lists its handler classes in its `@Module({ providers })`, and Nest's explorer registers every `@CommandHandler`/`@QueryHandler` it finds on boot. A handler's dependencies are resolved by the module that provides it, so a handler that reaches another module does so through this module's own ACL adapter (ADR-0022), which the module also provides — the foreign module is named in `imports` of `<feature>.module.ts` and nowhere else (ADR-0032).

### Boot completeness is a test, not a boot check

Nest's bus routes by the message class at dispatch time and cannot refuse to boot on a message no handler answers; the first dispatch of an unrouted message throws `CommandHandlerNotFoundException`, possibly in production. Two checks close that gap:

- `<feature>.command-handlers.ts` declares `xCommands` (the message classes) and `xCommandHandlers` (the handler classes) side by side; `<feature>.handlers.test.ts` calls `assertHandlersCover(kind, messages, handlers)` (`platform/cqrs/messages.ts`), which reads the handler metadata `@nestjs/cqrs` stamps and fails on an unrouted message, a duplicate handler, or a handler for a message the module does not declare.
- The registration test runs in the unit suite, so a message added without a handler is red before it is merged.

### Per-module dispatch surfaces become naming and import discipline

The Effect edition narrowed what a peer could dispatch with a per-module dispatcher and `subsetOf`. `@nestjs/cqrs` has one bus, so narrowing is done at the source and the edge instead: `<feature>.exports.ts` publishes the message _classes_ a peer may construct as `xAccessCommands`/`xAccessQueries`, and the manifest holds a consumer to reaching them only through its own `<feature>.imports.ts` from `infrastructure/acl/**` or `interface/events/**` (ADR-0032). A peer cannot construct a message it was not granted, because it cannot import the class.

### File layout: message and handler are separate files

`<verb-noun>.command.ts` (or `.query.ts`) holds the message class, its result view types and the payload type — the **public contract**. `<verb-noun>.handler.ts` holds the `@CommandHandler` class — **internal** to the module, imported only by `<feature>.command-handlers.ts` and its own test. Importing a message contract must not drag the handler's transitive imports along.

### Who is allowed to dispatch what

- **Transport adapters** dispatch any of their own module's commands and queries.
- **Cross-module reads** go through the consumer's own outbound port, whose adapter is the one place permitted to dispatch the foreign query (ADR-0022).
- **Cross-module writes default to Command → Event → Command** (ADR-0007).
- **The exception is a write whose result the caller needs synchronously, inside its own unit of work** — just-in-time user provisioning on first sign-in. It goes through an outbound port, and because the adapter dispatches a command that runs `unitOfWork.run` re-entrantly, the write joins the caller's transaction.

## Consequences

- Call sites get the full success and error type through the bus, with nothing to provide.
- Each message is declared once. Adding one is a class, a handler class, and two entries in the module's registration file.
- There is no `R` channel to clear and no per-module dispatcher to compose; the cost is that the compiler no longer proves a handler exists — the registration test does.
- A duplicate handler for one message is caught by the test; Nest itself would silently keep the last one registered.
- No middleware seam beyond the span: Nest's bus has none, and the Effect edition's `deadline`/`metrics` middleware are not ported. Interruption does not exist: a client hanging up does not abort a command; it commits or rolls back as a whole.
- `@nestjs/cqrs`'s `EventBus`, `@EventsHandler` and `@Saga` are **not used** and the manifest refuses them everywhere: `EventBus.publish` is fire-and-forget on RxJS and cannot express the immediate-consistency subscription ADR-0007 requires.

## Supersedes / differs from the Effect edition

`Command.make` → `class X extends Command<XResult>`; `Command.group` + `handlersOf` + `dispatcher` → `@CommandHandler` classes listed in the module's providers; `declaredIn` boot check → `assertHandlersCover` in a test; `checkSerializable` → not ported (the payload is a plain type, not a schema — a module extraction would add one at that time); RPC transport → Nest's in-process bus; `subsetOf` → the peer-surface naming + import rule.

## Alternatives considered

- **No bus at all.** Endpoints call handler classes directly. Rejected because the boundary should exist before non-HTTP transports do — and it does: CLI endpoints and event adapters already dispatch.
- **Nest's bus without the wrapper.** Rejected — no span, and a call site that names `CommandBus` from `@nestjs/cqrs` is one import away from the `EventBus` beside it.
- **A hand-rolled typed bus (Map of class → handler).** Rejected — `@nestjs/cqrs` already gives the typed `execute` and the explorer; rebuilding it buys nothing.
- **`Result` unwrapped to throw at the bus.** Rejected — duplicates ADR-0004's boundary decision inside the transport.

## Related

- ADR-0004 (errors) — the `E` channel preserved through the bus.
- ADR-0007 (unit of work and event bus) — handlers run in the dispatching async context, so a command dispatched inside a publisher's transaction lands in a nested savepoint.
- ADR-0012 (observability) — the span the wrapper opens.
- ADR-0022, ADR-0024, ADR-0032.
