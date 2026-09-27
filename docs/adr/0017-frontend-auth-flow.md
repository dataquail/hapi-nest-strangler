# ADR-0017: Frontend authentication — server-mediated, no tokens in the client

- Status: Accepted
- Date: 2026-04-30
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

ADR-0016 picked Zitadel as the IdP and put the OIDC dance entirely on the server: the browser never sees an access or id token, only a session cookie. That decision shapes the frontend's auth code: there is no token to manage, no `oidc-client-ts` SDK to import, no refresh-token storage strategy to argue about. What's left for the frontend to own is small but specific — knowing whether the user is signed in, redirecting to the right place when they aren't, and offering a sign-out affordance.

The constraints from the rest of the frontend:

- A View may not import `services/` or TanStack Query directly (ADR-0026). Auth state surfaces through the Model.
- Everything with behaviour is a ViewModel with a sibling test; a server component in `app/` composes the Model directly.
- The renderer is Next.js (App Router); the Nest server stays the BFF and Next is a same-origin proxy in front of it (ADR-0018).

## Decision

The frontend owns three things: a server-side read of `/auth/me`, a server-side route guard on the authed layout, and a sign-out link that does a plain navigation. Everything else is a server redirect.

### `services/data-access/me.server.ts` — `fetchCurrentUser`

A server-only helper (`import "server-only"`), wrapped in `React.cache` so the guard, a nested guard and the nav all share one `/auth/me` call per request. It reads through the per-request server client (`services/api/client.server.ts`), which forwards the inbound cookie, and returns the `CurrentUserResponse` or `null`. A 401 here is the _signal_ that drives the redirect, not an error to announce, which is why the helper folds every failure into `null` rather than throwing.

There is no client-side auth query and no mutation. Login and logout are both **navigations** (`/api/auth/login`, `/api/auth/logout`), because the server owns the redirect chain (ADR-0016). A logout mutation that invalidated a client-side `/auth/me` query was rejected in the Effect edition after the invalidation refetched with the just-cleared cookie and raced the navigation into a spurious error toast; a plain navigation removes that failure mode, and this edition never had the query to invalidate.

### `app/(authed)/layout.tsx` — server-component guard

The authed route group's layout is a **server component**. It calls `fetchCurrentUser()`; on `null` it `redirect()`s to `/api/auth/login` via `next/navigation`; on success it renders the shell and children, prefetching the caller's organizations for the nav switcher unless they are a super-admin. Because the check runs on the server before the authed layout renders, there is no blank-surface or "Signing you in…" flash. `redirect()` throws a marker React unwinds, so it must not sit inside a `try/catch`.

### The client and same-origin

The browser client (`services/api/client.shared.ts`) is `openapi-fetch` over the generated `paths`, `baseUrl: "/api"`, `credentials: "include"` (belt-and-suspenders; same-origin requests attach the cookie anyway). The server-side variant is built per request against `SERVER_INTERNAL_URL` with the inbound `Cookie` header copied on. Same-origin is achieved by Next's `rewrites()`: the browser hits `/api/*` on the Next origin and Next forwards to the Nest server with the `Cookie` header attached (ADR-0018). The session cookie is `SameSite=Strict`, so the single public origin is what keeps it flowing.

### What the frontend does **not** own

- **No OIDC SDK.** `oidc-client-ts`, `oauth4webapi`, etc. are not dependencies.
- **No callback route.** Zitadel redirects to `/auth/callback` on our server, not on the frontend.
- **No token storage.** The session cookie is `HttpOnly` and inaccessible to JS.
- **No refresh logic.** When the cookie expires, `/auth/me` 401s, the guard redirects, the OIDC flow re-establishes a session.

## Enforcement

- **`pnpm lint`** — `me.server.ts` is a Model file and follows the Model's allowlist; the `*.server.ts` naming plus `import "server-only"` keeps the cookie-reading side effect out of the client bundle.
- **End-to-end coverage** — Playwright drives the real Zitadel hosted UI (`auth-setup` project + `login.spec.ts`).

## Consequences

- **The frontend's auth code is small and obvious.** A cached server read, a server-component guard, and a sign-out navigation.
- **Logout actually logs out.** Click sign-out → server revokes session row → 302 to Zitadel `end_session` → SSO cookie cleared → 302 back → fresh password prompt.
- **`SameSite=Strict` has a small UX cost.** A cross-site deep link won't carry the cookie on the initial top-level navigation, so the user bounces through Zitadel. Usually silent.
- **`prompt=login` on every login (ADR-0016) means every authentication shows the password form.**

## Supersedes / differs from the Effect edition

`fetchCurrentUser` runs the `openapi-fetch` client instead of an `HttpApiClient` Effect on a per-request runtime; there is no per-request runtime to build (ADR-0026). The guard, the navigations and the cookie story are unchanged.

## Alternatives considered

- **`oidc-client-ts` in the frontend.** Rejected — defeats the BFF (ADR-0016).
- **A client-side `useQuery` for `/auth/me`.** Rejected — the guard is a server component and needs no client query; a client copy would be a second source of truth and a second place a 401 could surface as a toast.
- **Render "Signing you in…" copy in a client guard's pending state.** Rejected — with the server-component guard there is no pending state to render.

## Related

- ADR-0026 (TanStack Query and MVVM) — the Model tier `me.server.ts` belongs to.
- ADR-0016 (server-side auth) — the BFF this ADR is the frontend counterpart to.
- ADR-0018 (Next.js renderer) — the server-component guard and the `/api/*` rewrite this ADR relies on.
