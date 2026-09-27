# ADR-0005: Repository pattern — dumb, specification-queried ports (Live + Fake in infrastructure)

- Status: Accepted
- Date: 2026-07-13
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

The architecture demands several things of the persistence layer simultaneously:

1. **The domain layer is free of persistence concerns.** Domain code must compile and be reasoned about without knowing whether storage is SQL, in-memory, or remote.
2. **Use cases are unit-testable without a database.** A test that exercises a command handler should not require docker, migrations, or a connection pool.
3. **Production wiring supports transactions** that span multiple repository calls and event handlers.
4. **The repository stays dumb.** Its job is narrow — persist the current state of an aggregate and fetch it back. The aggregate carries the invariants and the domain verbs; the use case orchestrates and declares the transaction boundary; the repository only writes the resulting state and reads it again.

The fourth demand is easy to state and easy to erode: a domain-verb method (`creditFunds`, `grantAccess`) appears on the port and forces the `Live` to express domain decisions as SQL, or read-method bloat re-encodes a domain predicate as bespoke SQL per variant that drifts from the same rule expressed in memory.

## Decision

For each aggregate: a port in its subdomain folder (`domain/<subdomain>/`), a `Live` and `Fake` in `infrastructure/repositories/`, and a mapper. Reads are expressed with **specifications**, and the port speaks a fixed, minimal vocabulary that a `members` rule keeps dumb.

### Port

The port is an **abstract class with abstract methods** — the class is both the type and the Nest injection token, which is what lets `@Inject(UserRepository)` name it without `emitDecoratorMetadata`. Method signatures are typed in terms of domain aggregates, not rows, and return `Promise<Result<...>>`. The transient-store failure is `PersistenceUnavailable` (from `platform/ddd/contracts/`). Absence is `null` (`findOne`) or an empty array (`findMany`); mapping `null` to a domain `NotFound` is the use case's job.

```ts
export abstract class InvitationRepository {
  public abstract insertOne(
    invitation: InvitationRoot,
  ): Promise<Result<void, PersistenceUnavailable>>;
  public abstract updateOne(
    invitation: InvitationRoot,
  ): Promise<Result<void, InvitationNotFound | PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<InvitationRoot>,
  ): Promise<Result<InvitationRoot | null, PersistenceUnavailable>>;
  public abstract findMany(
    spec: Specification<InvitationRoot>,
  ): Promise<Result<ReadonlyArray<InvitationRoot>, PersistenceUnavailable>>;
}
```

### The vocabulary

Every repository method is one of `insertOne`/`insertMany`, `updateOne`/`updateMany`, `deleteOne`/`deleteMany`, `upsertOne`/`upsertMany`, and the **only** reads, `findOne`/`findMany`, each taking a `Specification`. There are no `findOneById` / `findOneOpenBy…` methods: identity lookups, natural-key lookups and variant selection are all a specification at the call site — `repo.findOne(InvitationSpecifications.withToken(token))`.

### Specification: one predicate, two interpreters

A `Specification<T>` (`platform/ddd/contracts/specification.ts`) is a **callable predicate that also carries a translatable `Criteria` AST**. `Spec.eq`, `Spec.isNull`, `Spec.isNotNull`, `Spec.and`, `Spec.or`, `Spec.not` produce both halves at once:

- **Domain guards** call it as a predicate: `if (InvitationSpecifications.isAccepted(invitation)) …`.
- **The fake** filters in memory with the same object: `[...store.values()].find(spec)`.
- **The live** compiles `.criteria` to a slonik `WHERE` fragment with `criteriaToWhere(spec.criteria, columns)` (`platform/persistence/criteria-to-sql.ts`).

### The boundary: what a specification may express

The `Criteria` AST has only **root-level scalar** nodes. The specification carries only the predicate; the repository owns FROM, JOINs, projection, ordering and reconstitution — the compiler emits nothing but the `WHERE`. A predicate that reaches into a child collection is a plain `Predicate<T>`, usable as a guard or a post-load filter but **not assignable to `findOne`/`findMany`**.

### Live implementation

`infrastructure/repositories/<feature>.repository-live.ts` is `@Injectable() class XRepositoryLive extends XRepository`, taking the `Database` token. Every method is a slonik statement — `sql.type(RowSchemas.XRow)` for reads, `sql.unsafe` for writes whose row count is the answer — run through `translateDatabaseErrors`, which turns a transient outage into `Err(PersistenceUnavailable)`, lets the caller map a named constraint to a domain error, and rethrows everything else as a defect. The client joins any active transaction automatically (ADR-0007). A read runs `SELECT <projection> FROM <tables> WHERE ${criteriaToWhere(spec.criteria, columns)}` and decodes through the row schema; a row that fails its schema is a defect.

### Fake implementation

`<feature>.repository-fake.ts` is `class XRepositoryFake extends XRepository` backed by a `Map`. `findOne`/`findMany` filter with the specification directly. The fake must mirror the live repository's **row model**: an aggregate the live persists as zero rows must be un-findable in the fake too.

### Mapper

`<feature>.mapper.ts` exports `columns` (the field→column map the compiler consumes) and `toDomain(row)`. A single-row aggregate maps one row (`findOne` runs `maybeOne(… LIMIT 1)`); a multi-row aggregate reconstitutes from the row set (`findOne` runs `any(…)`, groups, returns `null` for zero rows). For variant aggregates the mapper switches on the persisted discriminant column.

### Two rules keep the port dumb

1. **`architecture/members`** on `domain/<subdomain>/*.repository.ts` requires every member of a `*Repository` class to be one of the write verbs or bare `findOne`/`findMany`. A domain verb, a missing `One`/`Many`, or a keyed finder fails with a message that says to move behaviour onto the aggregate or express the lookup as a specification.
2. **`architecture/imports`** on `infrastructure/repositories/` refuses the module's own `commands/`/`queries/` and the application-tier tokens (`AppCommandBus`, `AppQueryBus`, `DomainEventBus`, `UnitOfWork`). A repository that reaches for these is smuggling orchestration into persistence.

### Test exemption

Test files in `commands/` and `queries/` may import from `infrastructure/` so unit tests can pull in the fake. Production code in those folders may not.

## Consequences

- The domain layer has zero infrastructure dependencies.
- Use-case unit tests need only the fake repository, the recording event bus, and the pass-through unit of work. No database.
- A lookup is defined once, as a specification, and reused by guards, the fake and the live query.
- Two implementations of the same port must stay in sync; the abstract class makes signature drift a compile error, and the fake and live integration tests exercise the same specifications.
- Repositories are _transaction-passive_.
- Reads that legitimately bypass the aggregate live in `queries/` and address the database directly.

## Supersedes / differs from the Effect edition

`Context.Service` + `XRepositoryShape` → one abstract class; `Effect<A, E>` → `Promise<Result<A, E>>`; `Layer.effect(...)` → `{ provide: XRepository, useClass: XRepositoryLive }` in the module; `Ref<Map>` → a `Map` field. The `members` rule reads class members instead of a type literal.

## Alternatives considered

- **Cardinality-explicit keyed finders.** Rejected — every variant added a port method plus a bespoke `WHERE` that drifted from the fake.
- **Query-object specifications that own the whole query.** Rejected — leaks persistence into the domain.
- **TypeORM / Prisma / MikroORM entities.** Rejected — change-tracking proxies and identity maps leak persistence semantics into the domain, and an ORM entity is not the dumb value ADR-0003 wants.
- **Generic `Repository<T>` base class.** Rejected — writes stay per-aggregate and honest.
- **Domain-verb methods on the port.** Rejected — that is business logic; the `members` rule rejects it by name.
- **An `interface` plus a string token for the port.** Rejected — an interface has no runtime value to inject by, so every consumer would carry a separate token constant; the abstract class is one name.

## Related

- ADR-0001, ADR-0003, ADR-0007 (the ambient transaction the live joins), ADR-0009 (the fake in use-case tests).
