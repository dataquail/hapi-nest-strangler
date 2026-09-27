# ADR-0003: Aggregates as zod schemas; pure ops return { state, events }

- Status: Accepted
- Date: 2026-04-24
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

ADR-0001 established that domain logic is pure functions over plain data. This ADR pins down the _shape_ of those data and functions: how an aggregate is represented, how invariants are enforced, and how operations return both the new state and any events the operation produced.

The forces:

- An aggregate must enforce invariants on construction. There should be no way to obtain an aggregate instance that violates its rules.
- Events emitted by domain operations are first-class outputs of those operations, alongside the new state. Their generation should not be a hidden side effect.
- Aggregates need to decode at the persistence boundary without bespoke serialization code.
- Equality of two aggregate values should be structural, not by reference.

## Decision

### State and stereotype naming

Aggregate state is a zod object schema, exported under the same name as its inferred type:

```ts
// todo.root.ts — the dumb data type
export const TodoRoot = z
  .object({
    id: TodoId,
    organizationId: OrganizationId,
    title: z.string(),
    completed: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .readonly();
export type TodoRoot = z.infer<typeof TodoRoot>;
```

Identity, timestamps, and invariants live in the schema fields and any `.refine` layered on top. Construction is `TodoRoot.parse({...})` — the `make` that enforces the field invariants; a value that fails to parse is a defect, because only domain ops construct roots and they construct them correctly.

`domain/` is a container: one **subdomain folder per aggregate** (a consistency boundary), plus a `domain-services/` folder and a `ports/` folder. Each DDD stereotype is named by an explicit filename suffix and a matching identifier-keyword suffix:

- **Aggregate root** — two files. `*.root.ts` holds the root _data type_ `XRoot` (the schema and its type). `*.root-ops.ts` holds the _operations_, the `XRootOps` free-function bag. The test-parity obligation sits on `*.root-ops.ts`; the dumb `*.root.ts` carries none.
- **Constituent aggregate** — `*.aggregate.ts`; behavior in a sibling `*.aggregate-ops.ts`.
- **Entity** — `*.entity.ts` / `XEntity`; behavior in `*.entity-ops.ts`.
- **Value object** — `*.value-object.ts` / `XValueObject`: a zod object (multi-field) or a branded primitive; behavior in `*.value-object-ops.ts`.
- **Branded identifier** — `*.id.ts` / `XId`: `z.guid().brand<"XId">()`, minted from a string with `XId.parse(raw)`. `guid` rather than `uuid`, because test fixtures use structurally valid but non-RFC ids and the database column is `uuid`.
- **Specification** — `*.specification.ts` / `XSpecifications`: a free-function bag of pure predicates and derivations over an aggregate. It carries no state transition and emits no events.

Subdomain folders are **isolated from one another**: a file in `domain/<subA>/` may import only its own subdomain (plus `zod`, `oxide.ts`, the `platform/ddd/contracts/` tier, and `platform/ids/`), never another subdomain or `domain/ports/`. Cross-subdomain domain logic is a **domain service** in `domain/domain-services/` (ADR-0023).

### Operations

Operations are pure functions taking current state plus inputs (timestamps, ids) and returning either the next state directly or a record discriminated by domain meaning (`{ state, events }`). They are **not** methods or statics on the data — the aggregate root stays a dumb value. The operations live in a sibling `*.root-ops.ts` file, collected into a single frozen bag exported as `XRootOps`:

```ts
// invitation.root-ops.ts
export type Outcome = { readonly invitation: InvitationRoot; readonly events: ReadonlyArray<InvitationEvent> };

const issue = (input: IssueInput): Outcome => { ... };
const accept = (invitation: InvitationRoot, input: AcceptInput): Result<Outcome, InvitationAlreadyAccepted | InvitationRevoked | InvitationExpired> => { ... };

export const InvitationRootOps = { issue, accept, revoke, reissue } as const;
```

Consumers `import { InvitationRoot } from "./invitation.root.js"` and `import { InvitationRootOps } from "./invitation.root-ops.js"`. There is deliberately no `import * as`: every reference is a named import, so an aggregate can't drift to different aliases across files. The op's success payload is named `Outcome` so it does not shadow the imported `Result`.

The data and ops are **two files, not one**, because architecture enforcement is by file path (ADR-0008). Only command handlers may invoke a mutating op — but read-side code (queries, event adapters, mappers) legitimately imports the `XRoot` type. Splitting them lets the manifest gate the ops file to the write side while the data file stays freely importable.

### Specifications and the operation-stereotype privacy gradient

A **specification** (`*.specification.ts`) is an `XSpecifications` bag of pure predicates and derivations — `isExpired(token, now)`, `isAccepted(invitation)`. Because reading a predicate mutates nothing, a specification is importable from `domain/`, `commands/`, `queries/`, and `interface/events/`.

The operation stereotypes sit on a privacy gradient:

- `*.root-ops.ts` is the aggregate's single mutation surface: importable only from its own module's `domain/`, its own `commands/*.handler.ts`, test files, and repository fakes.
- `*.entity-ops.ts` / `*.aggregate-ops.ts` / `*.value-object-ops.ts` are **domain-private**.
- `*.specification.ts` is readable from `domain/`, `commands/`, `queries/`, and `interface/events/`.

Every operation bag and every specification carries a test-parity obligation. Wire-format formatters that are an aggregate's _own_ concern — assembling a credential's `pat_<publicId>_<secret>` form, formatting a human-typable device user code — stay in that aggregate's `*.root-ops.ts`.

### Lifecycle: guarded total operations (default) vs. variant types

The default — and what every aggregate here does — is a **single schema whose lifecycle is carried in flag/nullable fields, with total operations that guard their own invariants and return `Result<Outcome, DomainError>`** (`oxide.ts`). `InvitationRootOps.accept` takes an invitation in _any_ state and returns `Err(InvitationAlreadyAccepted | InvitationRevoked | InvitationExpired)` or `Ok(outcome)`. The invariant checks live in the domain, once; every caller gets identical enforcement.

A handler consumes such a `Result` with an early return: `if (accepted.isErr()) return accepted;`. The unit of work rolls back on an `Err` the handler returns (ADR-0007). One typing rule follows from `oxide.ts`: a **union of `Result` types cannot have its methods called** (each member's `this` type conflicts), so every command declares an explicit `XResult = Result<A, E1 | E2 | ...>` alias and the handler runs `this.unitOfWork.run<XResult>(...)`. The alias is the message's channel declaration (ADR-0006), so nothing is duplicated.

An alternative is to make illegal states unrepresentable: model each state as its own schema with a literal `_tag`, union them as the root type, and type each operation to accept only the legal source variant. **When to reach for variants:** the states carry _different data_, or a large operation×state matrix makes compile-time legality worth the structure. **The cost:** something must still narrow an aggregate loaded from the repository into the legal variant — centralize that narrowing in a single domain function so the guard logic stays in the domain once. Row→variant reconstitution lives in the mapper, which switches on the persisted discriminant column.

### Events

Domain events are tagged objects built with a small factory that the event bus accepts directly and infers the payload type from at subscribe sites:

```ts
export const OrganizationCreated = Event.make("OrganizationCreated", {
  organizationId: OrganizationId,
  name: z.string(),
});
export type OrganizationCreated = Event.Type<typeof OrganizationCreated>;
```

`Event` is `@org/event-bus/event`, reached by the domain through `platform/ddd/contracts/domain-event.ts` so `domain/` never names the library (ADR-0008). An event value is `{ _tag, ...payload }`; `OrganizationCreated.make(payload)` parses it, `OrganizationCreated.is(event)` narrows it.

### Composition by use cases

Use cases bind these together explicitly, declaring the transaction once at the boundary (ADR-0007):

```ts
@CommandHandler(CreateOrganizationCommand)
export class CreateOrganizationHandler implements ICommandHandler<CreateOrganizationCommand> {
  constructor(
    @Inject(OrganizationRepository) private readonly organizations: OrganizationRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: CreateOrganizationCommand): Promise<CreateOrganizationResult> {
    return this.unitOfWork.run<CreateOrganizationResult>(async () => {
      const { organization, events } = OrganizationRootOps.create({
        id,
        name: payload.name,
        now: new Date(),
      });
      const inserted = await this.organizations.insertOne(organization);
      if (inserted.isErr()) return inserted;
      await this.events.dispatch(events);
      return Ok(organization.id);
    });
  }
}
```

## Consequences

- zod provides decode at the persistence boundary, structural equality through plain objects, and a `parse` that is the constructor — with no additional code.
- Events are visible at the use-case level. Publication timing is explicit.
- Pure ops are trivially testable: call the op, assert on the returned state and events.
- Determinism cost: ops accept `now` and `id` as inputs. The use case is the place that calls `new Date()` and `crypto.randomUUID()`.
- The `XResult` alias per command is one more line per message, and the price of `oxide.ts` unions.

## Supersedes / differs from the Effect edition

`Schema.Class` → zod object + inferred type; `Schema.TaggedClass` variants → a literal `_tag` field per variant schema; `effect/Result` → `oxide.ts`; `DomainEvent(...)` → `Event.make(...)`; `yield* Effect.fromResult(...)` → an early `return` of the `Err`. Structural equality is what plain objects give — there is no `Equal` trait, and nothing here compared aggregates by `Equal` anyway.

## Alternatives considered

- **Aggregate with an internal `_domainEvents` queue.** Rejected — hidden mutable state, couples publication to repository writes.
- **Returning a tuple `[User, Events]`.** Rejected — the named record survives refactors better.
- **Generating ids/timestamps inside ops.** Rejected. Breaks determinism.
- **Plain TypeScript classes without a schema.** Rejected — gives up decode at boundaries without saving meaningful complexity.
- **Operations as methods or `static` members on the data class.** Rejected — couples behavior to data and breaks down for variant aggregates.
- **`class XRoot extends createZodDto(...)`-style Nest DTO classes as aggregates.** Rejected — those are wire shapes, and a class instance is not structurally equal to the object a row decodes into.

## Related

- ADR-0001 (functional core, imperative shell)
- ADR-0007 (unit of work + event dispatch — what the use case does with `events`)
- ADR-0008 (architecture enforcement — the path rules that gate `*.root-ops.ts`)
- ADR-0023 (domain services — the free-function-bag stereotype, and the specification-vs-domain-service boundary)
