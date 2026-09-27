# ADR-0016: Authentication via self-hosted Zitadel as a server-side BFF

- Status: Accepted
- Date: 2026-04-30
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

The application needs an authentication boundary: a way for a user to prove who they are, and a way for every protected endpoint to know who the caller is without re-establishing trust on every hop. Application code consumes a `CurrentUser` value (`sessionId` + `userId`, `@org/contracts/Policy`) through the `@Caller()` parameter decorator; this ADR is the real implementation behind it.

The constraints that mattered:

- **Cost.** Auth0 is the easy answer and the expensive answer. Cognito is cheaper but lock-in heavy and lacking features we'd want (clean OIDC, social providers behind a single switch, SAML later).
- **Graduation.** Whatever we self-host now needs a clean upgrade path to a managed offering of the _same_ product.
- **No tokens in the browser.** A SPA holding access + refresh tokens in `sessionStorage`/`localStorage` is the well-known XSS amplifier.
- **Application-side roles.** Permissions live in our `platform.roles` table, not in Zitadel. Authorization facts are computed server-side per request from local rows (ADR-0021).
- **Hex architecture must hold.** Auth doesn't get to bend the rules — `domain/`, `commands/`, `queries/`, `interface/`, `infrastructure/` discipline applies (ADR-0002).

## Decision

Self-host Zitadel via docker-compose. The server is the OIDC client; the browser never sees an access or id token. `modules/auth/` owns a `Session` aggregate; the auth guard is implemented in terms of a session cookie the server itself issues.

### Zitadel as the IdP, the server as the Relying Party

Zitadel runs alongside Postgres + Jaeger in `docker-compose.yml`. It owns identity (email, password, MFA, future social/SAML providers), nothing else. It does **not** own roles or app-level permissions — those stay in our DB.

The Zitadel admin user is declared via `FirstInstance` config (`infra/zitadel/zitadel.yaml`); the project + OIDC application are created idempotently by `infra/zitadel/seed.mjs`, which also pre-seeds the admin's local `users` + `auth_identities` rows so the first sign-in finds an existing identity. The OIDC application is a confidential client (`client_secret` lives only on the server) so it can speak the back-channel token exchange.

### BFF: the server holds tokens, the browser holds a session cookie

Login flow: the browser navigates to `GET /auth/login` on **our** server (through Next's `/api/*` rewrite — ADR-0018). `LoginEndpoint` asks `OidcClient` (`modules/auth/infrastructure/clients/oidc.client.ts`, over `openid-client`) for a PKCE authorize URL, packs `{ state, codeVerifier }` into a signed short-lived `oidc_pkce` cookie, and redirects to Zitadel. Zitadel authenticates the user and redirects back to `/auth/callback?code=…`. `CallbackEndpoint` verifies the PKCE cookie, exchanges the code on the back-channel (openid-client verifies the id_token via JWKS), dispatches `SignInCommand`, sets a `session=<uuid>.<hmac>` cookie, and redirects to the app. **The Zitadel access and id tokens are discarded after id_token verification** — we don't make outbound calls as the user, so there's nothing to keep them for.

The session cookie is `HttpOnly; SameSite=Strict; Path=/`. The OIDC PKCE cookie is `SameSite=Lax` because it must survive Zitadel's cross-site redirect back to `/auth/callback`. Two cookies, two SameSite values, intentionally. Both are written with Express's `response.cookie` from the endpoint, which is why the two redirect endpoints take `@Res()` and answer the response themselves rather than returning a value.

Logout flow: the browser navigates to `GET /auth/logout` (idempotent, public — works even with no live session). `LogoutEndpoint` reads the cookie inline, dispatches `RevokeSessionCommand` if it verifies, clears the cookie, and 302s to Zitadel's `end_session_endpoint` so the SSO cookie is torn down too; if discovery is down it lands on `APP_URL` instead, and the SSO cookie waits for the next interaction. `prompt=login` on the authorize URL means prior accounts don't surface in an account picker.

### `modules/auth/` owns Session

`Session` is an aggregate, not a leaf record. Sliding TTL with an absolute cap (`SESSION_TTL_SECONDS` / `SESSION_ABSOLUTE_TTL_SECONDS`). The aggregate, repository (live + fake), the `SignIn`, `RevokeSession` and `TouchSession` commands, the `FindSession` query, and the endpoints live under `modules/auth/` per the module conventions (ADR-0002, ADR-0013). A few things sit at platform level:

- `platform/auth/cookie-codec.ts` — generic HMAC sign/verify, used by the auth module's endpoints and by the authenticator.
- `platform/auth/authenticator.ts` — the `Authenticator` port: `fromBearer(token)` and `fromSessionCookie(cookieHeader)`, each resolving to a `CurrentUser` or throwing a 401/503 problem.
- `platform/middlewares/authenticator-live.ts` — the implementation. It dispatches `FindSessionQuery` (or `FindApiTokenByHashQuery` for a bearer), dispatches the matching touch command fire-and-forget, and returns the caller. It names the auth module's messages through `auth.platform.ts`, the module's platform surface (ADR-0032).
- `platform/middlewares/user-auth.guard.ts` — `UserAuthGuard`, a `CanActivate` that reads the `Authorization` header, picks the bearer or the cookie path on the port, and attaches the result to the request for `@Caller()`.

**Why the guard depends on a port and not on the auth module.** Every endpoint names `UserAuthGuard` in a `@UseGuards` decorator, which runs at class-definition time, and the auth module's own endpoints are among them. If the guard imported `auth.platform.ts`, loading any endpoint would load the auth module, which loads its endpoints, which load the guard — an ES-module cycle that Nest reports as `Invalid guard passed to @UseGuards()`. The port breaks the cycle: the guard names `Authenticator`, `AuthzModule` provides `AuthenticatorLive`, and only the live names the auth module. Authorization checks themselves live in the per-route policy layer (ADR-0021).

### Sliding-TTL refresh via `TouchSessionCommand`

Every authenticated request, after `FindSessionQuery` succeeds, the authenticator dispatches `TouchSessionCommand`. The handler:

- Skips the write when the prior `lastUsedAt` is younger than `SESSION_TOUCH_THRESHOLD_SECONDS` (default 60). Without this throttle, a busy client would hammer Postgres with one UPDATE per request for no real-world benefit.
- Computes the new `expiresAt` via `SessionRootOps.touch`, which clamps to `absoluteExpiresAt` so the hard cap holds.
- Persists via `SessionRepository.updateOne`, whose SQL `WHERE revoked_at IS NULL` guards against touching a session revoked between the query and the command. The command is declared infallible (`Result<void, never>`): a session revoked or removed mid-flight is benign, and a transient outage must not fail a request whose authentication already succeeded.

The dispatch is **fire-and-forget**: the authenticator does not await the command's promise (a rejection is swallowed), so the touch's read-and-maybe-write never sits on the auth critical path. An in-flight touch can be dropped on restart, which is harmless for a stamp the next request re-applies. The bearer path (CLI / MCP) dispatches its analogous `TouchApiTokenCommand` the same way, for the same reason.

This keeps lifecycle reads (`FindSessionQuery`) and writes (`TouchSessionCommand`) on opposite sides of CQRS without putting business logic in the guard.

### Physical eviction via `@org/jobs`

The TTL/revocation logic only governs _validity_ — expired and revoked rows still occupy `auth.sessions` until something physically deletes them. `@org/jobs` runs `purgeExpiredSessions` on an hourly `croner` schedule (`0 * * * *`, plus one eager run on boot):

```sql
DELETE FROM auth.sessions
WHERE expires_at < now()
   OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days')
```

The 7-day grace on revoked rows preserves a short audit window. A Postgres transaction-scoped advisory lock (`pg_try_advisory_xact_lock`) guards the run so concurrent replicas don't race on the DELETE; a second replica short-circuits with `{ skipped: true }`. `@org/jobs` is its own deployable: it depends on `@org/database` and owns its DELETE SQL directly — it does **not** import `@org/server` or share the auth module's `SessionRepository`.

### Row validation actually runs

`sql.type(RowSchemas.SessionRow)` runs the zod row schema over every row that comes back, through the result-parser interceptor in `@org/database`, and treats a mismatch as a defect. Timestamps arrive as `Date` through the package's type parsers, so `expires_at` and `absolute_expires_at` compare against `Date.now()` directly.

## Enforcement

- **`pnpm lint`** — `modules/auth/` follows the standard module rules (ADR-0008). `platform/middlewares/authenticator-live.ts` reaches the auth module through `auth.platform.ts` like every other platform file (ADR-0032); the guard reaches only `platform/auth/`.
- **Parity** — the manifest requires sibling tests for the `Session` aggregate, both repositories (live + fake), and the endpoint files; `login`/`logout` are the named endpoint-parity exemptions (ADR-0013), covered end-to-end by Playwright + `SessionRepositoryLive` integration tests against a real Zitadel.

## Consequences

- **The browser never holds a token.** Every API request is same-origin (ADR-0018); the session cookie travels automatically.
- **Logout is real logout.** Both our session and Zitadel's SSO session are torn down.
- **The graduation path is intact.** `OidcClient` depends only on OIDC discovery + JWKS. Pointing `ZITADEL_ISSUER` at Zitadel Cloud requires no code change.
- **Non-admin JIT provisioning is in scope.** An unknown subject with an email is provisioned as an ordinary user inside the sign-in's unit of work through the auth module's `UserProvisioning` ACL port (ADR-0022); one without an email is refused. Refresh tokens remain out of scope.

## Supersedes / differs from the Effect edition

`HttpApiMiddleware` providing `CurrentUser` into the endpoint's environment → a Nest `CanActivate` guard attaching it to the request and `@Caller()` reading it back; `Effect.forkDetach` → an un-awaited promise; the middleware importing the auth barrel directly → the `Authenticator` port plus a live, forced by decorator-time evaluation. The cookie, redirect and session designs are unchanged.

## Alternatives considered

- **Auth0 / Clerk / WorkOS hosted auth.** Faster to integrate, weaker on cost and lock-in.
- **AWS Cognito.** Cheaper than Auth0, but DX and feature set didn't match Zitadel, and AWS lock-in was the bigger objection.
- **Keycloak.** Rejected because Red Hat's hosted offering is a separate product; Zitadel's `zitadel.cloud` is line-for-line the same software.
- **Tokens in the browser.** Rejected on XSS grounds.
- **`@nestjs/passport` with a session strategy.** Rejected — it would put the session lookup in a strategy class outside the CQRS surface, and the guard's whole job here is to dispatch two messages.
- **A guard that imports the auth module directly.** Tried; it is the cycle described above.

## Related

- ADR-0002 (module layout), ADR-0008 (enforcement), ADR-0013 (endpoint conventions).
- ADR-0017 (frontend auth) — the browser-side counterpart.
- ADR-0018 (Next.js renderer) — the same-origin proxy the cookie flows through.
- ADR-0021 (per-route authorization) — how `CurrentUser` is consumed by policy checks.
- ADR-0032 (imports and exports) — why the authenticator reaches the auth module through its platform surface.
