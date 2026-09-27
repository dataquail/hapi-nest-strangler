# ADR-0012: Observability — OpenTelemetry spans at the buses and the boundaries, OTLP export

- Status: Accepted
- Date: 2026-04-24
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033); slug was `observability-effect-spans-and-otlp`

## Context and Problem Statement

A production system without observability is one you can only debug from logs someone thought to write before the incident. The OpenTelemetry Node SDK gives structured tracing with automatic context propagation across `async` boundaries, and exports spans to any OTLP-compatible collector. The marginal cost of adding tracing from the start is small; the cost of adding it during an incident is enormous.

The forces:

- Every meaningful unit of work — an HTTP request, a use case, a repository call — should produce a trace span. Spans nest naturally; a trace for a request should show HTTP → use case → SQL as a tree.
- Trace propagation across in-process operations should be automatic. Manual context-passing for traces produces fragmentary traces that miss the interesting causal links.
- A span should carry the identity of the code that produced it, so a span in the collector points back at the use case that emitted it.
- Application-level correlation (request id, authenticated user id) is a _separate_ concern from trace propagation. OpenTelemetry trace ids are correct for "show me this request's trace"; they are not correct for "show me every event caused by user X." Both are useful, and the architecture distinguishes them.
- Local development should require minimal setup to see traces.

## Decision

### Span discipline — boundary spans plus a use-case span, no finer

Spans live at architectural boundaries **and** at each use-case dispatch; nowhere finer.

The boundary spans:

- **HTTP (and CLI) endpoints** are spanned by the OpenTelemetry HTTP/Express auto-instrumentation, which names the span after the route the controller registered.
- **The command bus** spans every dispatch: `command.<CommandName>`. `AppCommandBus` (`platform/cqrs/command-bus.ts`) opens it around Nest's `CommandBus.execute`, which itself opens none.
- **The query bus** spans every dispatch: `query.<QueryName>`, from `AppQueryBus`.
- **The domain event bus** spans every event: `event.<EventTag>` around the immediate subscribers, and `event.afterCommit.<EventTag>` around each post-commit handler (`@org/event-bus`).
- **Authorization** spans every check: `authz.hasPermissions.<resource>.<action>` (`@org/authz`).
- **SQL statements** are spanned by the `pg` auto-instrumentation.

The delimiter is a dot throughout, so one naming rule covers every span the system emits.

**The use-case span is the bus span.** A message's class name _is_ its tag (ADR-0006), so `command.CompleteTodoCommand` names the use case as precisely as a span on the handler would, and the handler runs entirely inside it:

```
POST /orgs/:orgId/todos/:id           (http auto-instrumentation)
└─ authz.hasPermissions.todo.update   (authz)
└─ command.CompleteTodoCommand        (bus = use case)
   └─ pg.query                        (pg auto-instrumentation)
```

Coverage is not a convention that can be forgotten: every use case is reached through a bus, the bus is the only dispatch surface, and the file taxonomy (ADR-0008) refuses a handler that is not a registered stereotype.

**Granularity rule.** Instrument at use-case granularity and no finer. A dispatch's span plus the retained SQL/event/endpoint spans is the whole story; do not open spans for private sub-steps. Where a use case delegates to a shared internal helper (the API-token mint core reused by the mint use case and the device-grant poll), the helper stays span-less so its `span.setAttribute` calls land on whichever use case invoked it. A shared helper acquiring its own span would be instrumentation below use-case granularity — a speculative-generality smell.

### Span attributes — extractor functions composed at registration

An extractor is a function from a message to an attribute map, returning only fields its author has audited as non-PHI/non-PII. Omitting a message emits no attributes, so the default is to leak nothing. Extractors are never methods on a class: messages and events are plain data, so the wire format and the in-memory format are the same shape, and a `toSpanAttributes()` method would disappear the moment something read a JSON row without decoding it.

Where the extractors live follows how the thing is registered:

- **Commands and queries** — one map per module, keyed by message class name, declared beside that module's handler registration in `<feature>.command-handlers.ts` / `<feature>.query-handlers.ts` and published through `<feature>.platform.ts`. `CqrsRuntimeModule` folds every module's map into the one `CommandSpanAttributes` / `QuerySpanAttributes` table the buses read, and refuses a key defined twice.
- **Domain events** — a sibling `<name>SpanAttributes` function next to each event definition, aggregated into `<feature>.event-span-attributes.ts` per module and merged the same way into the event bus. Events keep the sibling-file shape because subscribers register independently of definitions, so there is no single registration site to co-locate the map with.

Values _generated_ mid-handler (a freshly created user id) are attached with `trace.getActiveSpan()?.setAttribute(...)`, which annotates the enclosing bus span. The auth sign-in and API-token mint handlers do this for `user.id`.

### Export — the OpenTelemetry Node SDK, preloaded

The server starts with `tsx --import ./src/instrumentation.ts src/main.ts`. `instrumentation.ts` builds a `NodeSDK` with the OTLP HTTP trace exporter and the Node auto-instrumentations (with the noisy `fs` one off), and starts it before the application is imported — that ordering is what lets the instrumentations patch `http` and `pg` ahead of their first `require`. The Next server initialises `@vercel/otel` in `packages/web/instrumentation.ts` against the same collector, so W3C trace context propagates browser → Next → server and Jaeger stitches them into one trace (ADR-0018). The collector URL is `OTLP_URL`; local development runs Jaeger via `docker compose`.

### Two kinds of correlation

- **OpenTelemetry trace id** is automatic via the SDK's `AsyncLocalStorage` context manager and links spans across handlers, subscribers and SQL within one request — the right mechanism for "show me this request's trace."
- **Application-level correlation** belongs in domain events and structured logs so a downstream consumer can attribute an event to the originating user or request. Stamping domain events with `correlationId`/`causationId` is a known extension point, not yet taken.

## Consequences

- Every code path is observable end-to-end without ad hoc logging. A trace for a failed request shows which use case ran, which statement failed, and the cause.
- The causal tree matches the dispatch tree: an event subscriber's span nests under the command that published it (ADR-0007), and an after-commit reaction opens its own root beside it.
- Span cardinality is roughly one per handled operation above the SQL level; sampling at the batch exporter is the lever if it becomes a concern.
- Dependency on a local Jaeger instance for the development experience. Acceptable for the workflow value.

## Supersedes / differs from the Effect edition

Effect's first-party OTLP tracer → the OpenTelemetry Node SDK with auto-instrumentations; `Effect.fn("<handler>")` per handler → no per-handler span, because the bus span already names the use case by its class name; `Effect.annotateCurrentSpan` → `trace.getActiveSpan()?.setAttribute`; repository-method spans → the `pg` instrumentation's statement spans (a coarser view of the same tree); the `RequestContext` `FiberRef` → not ported, the extension point stands. The browser tracer is not ported; the Next server's `@vercel/otel` is.

## Alternatives considered

- **A span per handler class (a Nest interceptor or a decorator on `execute`).** Rejected — it would duplicate the bus span with the same name and no new information; the bus is the one dispatch surface, so it is the one place a use-case span needs to be opened.
- **Instrument below use-case granularity** (spans on domain ops, shared helpers, private sub-steps). Rejected — speculative generality; it inflates cardinality and couples the trace shape to internal factoring that carries no operational meaning.
- **`toSpanAttributes()` method on each command/query/event class.** Rejected — messages are plain data; plain structs plus sibling extractors are the same property without the serialization foot-gun.
- **Nest's own `Logger`-based request logging instead of tracing.** Rejected — a log line is not a tree, and the interesting question is always which use case a slow statement belonged to.
- **Vendor-specific tracing SDK.** Rejected — OTLP is the lingua franca; vendor lock-in at this layer is unnecessary.

## Related

- ADR-0006 (typed bus) — the dispatch surface the use-case span is opened on.
- ADR-0007 (unit of work and one event bus) — what makes subscriber spans appear under their publisher's trace.
- ADR-0008 (architecture enforcement) — the handler-stereotype discipline that keeps every use case behind a bus.
