# ADR-0018: Frontend renderer is Next.js; the Nest server stays the BFF

- Status: Accepted
- Amended: 2026-08-21 — sub-decision 1 restated over the state substrate of the day. The proxy/BFF decisions (2, 3, 4) are untouched.
- Date: 2026-05-08
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

The frontend is a renderer with a single job: render pages and proxy API calls to the Nest server. As a consulting template, the largest weakness of a static CSR-only SPA is optionality: an engagement that needs SSR (SEO, marketing-adjacent product, slow-network performance work) would require a framework migration mid-engagement. Choosing a renderer that supports CSR _or_ SSR per engagement without changing the architecture avoids that.

The decision is _not_ "add SSR." It is "pick the renderer that lets us choose CSR or SSR per engagement without changing the architecture."

The forces:

- We already have a working BFF (ADR-0016, ADR-0017): the Nest server runs the OIDC dance and issues an `HttpOnly` session cookie. Replacing it with a renderer-based BFF would re-do work that already works.
- The frontend reads through TanStack Query (ADR-0026). A renderer that natively supports `prefetchQuery` + `<HydrationBoundary>` preserves this surface and lets routes graduate to SSR per-need.
- The cookie story breaks if the renderer and the server are on different origins. `SameSite=Strict` (ADR-0017) means the browser will not attach the cookie cross-site; CORS+credentials does not save us.
- We don't want a second auth authority.

## Decision

The frontend renderer is **Next.js 16 (App Router, deployed as a Node server)**. Four sub-decisions lock the shape.

### 1. Server-side prefetch + hydration boundary + suspense read is the default

Each route's `page.tsx` composes `<QueryHydrationBoundary prefetch={[...]}>` (`services/query/hydration-boundary.tsx`) around the client subtree. The boundary awaits each `prefetch*` helper against a **per-request `QueryClient`** (`services/query/get-query-client.server.ts`, memoised with `React.cache` so a request never sees another request's cache), dehydrates it into TanStack's `<HydrationBoundary>`, and holds the subtree behind `React.Suspense`. The leaf View's ViewModel reads with `useSuspenseQuery`, so the data is present before paint and the client never shows an initial spinner for prefetched data. A failed prefetch yields no entry rather than throwing: the page still renders and the client query fetches for itself, surfacing the failure at the nearest error boundary. Writes are ViewModel mutations. Server Actions are not adopted.

The server-side prefetch uses the same `queryOptions` factory the client uses (`services/data-access/<feature>.queries.ts`), built over the per-request server client rather than the browser one. What crosses the RSC boundary is the wire JSON — dates are ISO strings on both sides, which is why `services/format/date.shared.ts` is a one-line slice.

### 2. The Nest server remains the BFF

It owns the OIDC dance with Zitadel, the session cookie, `CurrentUser`, and the role table. Next.js does **not** terminate auth, mint its own session, or hold OIDC tokens. Auth is _through_ Next, not _at_ Next. The trust boundary is the Nest server.

### 3. Next.js is a same-origin proxy in front of the Nest server

A single origin reaches the browser. The browser hits page paths and `/api/*` on the Next origin; Next forwards `/api/*` to the server via `rewrites()` (`next.config.ts`, target `SERVER_INTERNAL_URL`) with the inbound `Cookie` header attached. Consequences:

- **No CORS.** The browser only ever talks to one origin; the server's CORS policy is `APP_URL` only.
- **No service-to-service auth between Next and Nest.** The user's session cookie is the only credential.
- **Same cookie scope.** The session cookie is `HttpOnly; SameSite=Strict; Path=/` on the public origin. The server's `Set-Cookie` flows back through the rewrite unchanged.
- Next's file-system router owns page paths; the rewrite owns `/api/*`; the two are disjoint by path.

### 4. OpenTelemetry is wired on Next via `instrumentation.ts`

Next initialises `@vercel/otel` in `packages/web/instrumentation.ts` on boot, exporting to the same OTLP collector as the server (ADR-0012). W3C trace context propagates so a request entering Next produces a span, the proxied call to the server inherits the trace id, and Jaeger shows Next → server as a single trace.

## Consequences

- **One renderer buys SSR optionality forever.**
- **Hosting is "Node server + CDN," not "S3 + CDN."** A static SPA can be a cheap CloudFront + S3; Next needs a runtime.
- **A suspense read shifts the error-handling model.** Errors throw and propagate to the nearest `error.tsx` boundary; the notification path remains available to any ViewModel action that would rather report than throw.
- **Per-request state on the server is a `QueryClient`, not a runtime.** `React.cache` scopes it to the request; there is no module-global memo to leak into.
- **The contracts package is built before Next runs.** Turbopack resolves workspace imports through tsconfig `paths` and does not rewrite the contracts' NodeNext `.js` specifiers to `.ts`, so web's `paths` point at `packages/contracts/build/{esm,dts}` and `predev`/`prebuild`/`pretypecheck` run `pnpm -F @org/contracts build`. The generated OpenAPI types are imported through the `@org/contracts/generated/api` subpath for the same reason.
- **App Router cognitive overhead.** Server vs client component boundaries, `"use client"`, request-scoped vs module-scoped state — real overhead a SPA didn't impose.

## Supersedes / differs from the Effect edition

Sub-decision 1 is restated over TanStack Query: `AtomHydrationBoundary` → `QueryHydrationBoundary`, `useAtomSuspense` → `useSuspenseQuery`, the per-request `ManagedRuntime` → a per-request `QueryClient`. The memo-map hazard the Effect edition documented does not exist here. Sub-decisions 2–4 are unchanged.

## Alternatives considered

- **Static export as the deploy target.** Rejected: defers the SSR migration to mid-engagement.
- **TanStack Start instead of Next.js.** Genuinely close. Chosen against because Next is the industry default clients recognise, its instrumentation hook is more mature for OTEL, and the BFF concern disappears once Next is a proxy, not an auth authority.
- **Make Next.js the BFF; talk to the Nest server with a service token.** Rejected: doubles the auth surface area.
- **Server Actions for mutations.** Deferred. Every existing write flows through a ViewModel mutation cleanly.

## Related

- ADR-0026 — TanStack Query as the state substrate and the Model/ViewModel/View layering.
- ADR-0015 — frontend component library.
- ADR-0016, ADR-0017 — server-side and frontend auth.
- ADR-0012 — observability (extended to cover Next via `instrumentation.ts`).
