# ADR-0001: Functional core, imperative shell

- Status: Accepted
- Date: 2026-04-24
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

This codebase implements a domain-driven layered architecture on NestJS. Nest is paradigm-agnostic about the domain — domain logic could be expressed as `@Injectable()` classes whose methods mutate `this` and emit side effects through injected services, or as plain values manipulated by pure functions. The choice shapes everything downstream: how aggregates are constructed, how invariants are enforced, where events come from, how tests are written, and how easily code can be reasoned about in isolation.

We need a single discipline so that a contributor reading any module sees the same shape, and so that the rest of the architectural decisions in this set have a stable foundation to build on.

The forces:

- Domain logic should be testable without a runtime — no Nest container, no clock provider, no event bus, no `Test.createTestingModule` required to call a single function.
- zod integrates naturally with plain data and structurally-typed records. Stateful classes with hidden mutable fields fight that integration.
- Side effects (I/O, time, randomness, event publication) hidden inside aggregate methods make the data flow opaque. The point at which an event becomes "published" matters; making it implicit is a recurring source of bugs around transactional consistency.

## Decision

Domain logic is **pure functions over plain data**. Aggregates and value objects are zod object schemas (`z.object({...}).readonly()`) whose inferred type is the domain value. Aggregate operations are exported standalone functions that take the current state plus inputs and return a record containing the next state and any events the operation produced — they neither mutate nor emit.

```ts
export const create = (input: CreateInput): { user: UserRoot; events: ReadonlyArray<UserEvent> } => {
  const user = UserRoot.parse({ ... });
  return { user, events: [UserCreated.make({ ... })] };
};
```

All effectful concerns — I/O, time, randomness, logging, tracing, event publication — happen in the shell: use cases in `commands/` and `queries/`, and the inbound adapters in `interface/`. The domain uses `oxide.ts` `Result` as a _value_ (an op that can refuse returns `Result<Outcome, DomainError>`) and never imports Nest, slonik or the bus.

## Consequences

- Domain unit tests are plain function calls over plain data. No fakes for time, no DI container.
- Use cases must thread events from domain ops to the bus explicitly. This is the point: publication timing is visible at the use case, not implicit in a repository write or in a method call.
- Some lost ergonomics: `user.create(...).save()` chains aren't possible. Use cases orchestrate explicitly: `const { user, events } = UserRootOps.create(...); await repo.insertOne(user); await bus.dispatch(events)`. The trade is verbosity for legibility.
- Replacing primitives with value objects is unaffected — a zod schema works equally well for VOs and aggregates.
- Determinism: ops that need timestamps or ids accept them as inputs (`UserRootOps.create({ id, now, ... })`) rather than calling `new Date()` or `crypto.randomUUID()` themselves. The use case generates them and passes them in. This keeps every domain op a pure function of its inputs.

## Supersedes / differs from the Effect edition

The discipline is unchanged. What changed is the vocabulary: `Schema.Class` became a zod object schema and its inferred type; `effect/Result` became `oxide.ts` `Result`; the shell is a Nest handler class rather than an `Effect.gen`. The domain still names no runtime.

## Alternatives considered

- **Class with methods that return updated instances.** Workable, but most behaviors that look like methods on aggregates are better expressed as standalone functions: it removes the pretense that the aggregate is "doing" something on its own behalf, and avoids the temptation to mutate `this`.
- **Aggregate with an internal event queue** (`aggregate.addEvent(...)`; repository `save` drains it). Rejected. The queue is hidden mutable state that isn't part of the schema, and it ties event publication to persistence — making it impossible to publish events without a write, or write without publishing events. Both are real use cases.
- **Domain ops returning `Promise`** (or taking injected services). Rejected. Forces every consumer to be async and inside a container to call a domain function, and defeats the "no runtime needed for domain tests" property.

## Related

- ADR-0003 details the shape of aggregates, value objects, and event records that follows from this decision.
- ADR-0009 (testing pyramid) leans on this to keep domain unit tests runtime-free.
