# ADR-0023: Domain services and interface utility helpers

- Status: Accepted
- Date: 2026-07-02
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

Two genuinely distinct gaps in the stereotype vocabulary — one in the domain, one in the interface layer — need filling, rather than a single "misc helper" category that the folder-layout allowlist (ADR-0008) would otherwise reject with no sanctioned home.

**Gap 1 — shared domain logic with no aggregate home.** Hashing a credential (sha256-hex) is applied to API-token secrets, device-grant codes, _and_ an arbitrary incoming bearer in the authenticator, where there is no aggregate instance at all. It encodes a real bounded-context rule — "auth credentials are stored and compared by their hash, never in plaintext" — that belongs to no single aggregate. The codebase had no stereotype for "stateless domain logic that spans aggregates."

**Gap 2 — shared, testable protocol plumbing in an interface adapter.** The OIDC login/callback endpoints share two pure helpers: `buildCallbackUrl` (reconstructs the absolute `redirect_uri` around Next's `/api` rewrite) and the PKCE cookie codec (`encode/decodePkcePayload` + the cookie name/TTL). Both were extracted deliberately, to unit-test fiddly, security-relevant logic without a live OIDC client or HTTP runtime; the cookie codec is additionally the shared contract between the endpoint that sets the cookie and the one that reads it. Neither is domain logic — they manipulate HTTP request artifacts and OIDC protocol state, which by ADR-0016/0017 must stay out of the (provider-agnostic) domain.

The risk in filling either gap is convention drift — a generic "utils allowed" escape hatch that an agent (or a rushed human) uses to smuggle logic past the architecture.

## Decision

### Domain services — `*.domain-service.ts`

A **domain service** is a sanctioned domain stereotype: stateless domain logic that no single aggregate owns. It lives in `domain/domain-services/`, is a pure free-function bag (matching the `XRootOps` style — _not_ an `@Injectable()`; there is nothing to configure or fake for a pure function), and carries a test obligation.

Because `domain/` is organised into subdomain folders that are isolated from one another (ADR-0003), a domain service is also the one domain location permitted to **compose more than one subdomain**. `invitation-acceptance.domain-service.ts` (organization module) composes the invitation and membership subdomains: accepting an invitation makes the invitee a member.

`CredentialHash.of` lives in `credential-hash.domain-service.ts` (auth module). The API-token wire format (`assembleToken`, `displayPrefix`) sits on `ApiTokenRootOps` and the user-code format (`toUserCode`) on `DeviceGrantRootOps`, because those _are_ their aggregates' own concerns — only the cross-cutting hash graduates to a service.

**The guard against anemia.** A `*.domain-service.ts` is only for logic that genuinely has _no aggregate home_. Logic that operates on or produces one aggregate stays on that aggregate's `*.root-ops.ts` bag.

**Specification vs. domain service.** A `*.specification.ts` is a **predicate or derivation over a _single_ aggregate** — `isExpired(token, now)` — read-only, importable from `queries/` and `interface/events/` as well as the domain. A domain service is **stateless logic that spans aggregates or has no single aggregate home**.

**Purity still splits it.** Credential _hashing_ is pure → domain service. Credential _generation_ is impure (randomness) and stays in the command handler (the shell), exactly as `MintApiTokenHandler` and `StartDeviceGrantHandler` do — the domain never generates entropy.

### Interface utilities — `*.util.ts`

A `*.util.ts` is a pure, leaf, shared protocol/wire helper in an interface adapter. It is allowed **only in `interface/http/` and `interface/cli/`** — and deliberately **nowhere else**.

- In `interface/`, a helper is protocol/wire adaptation _by the nature of the layer_. Low risk.
- In the application layer (`commands/`, `queries/`), a shared pure helper is a _smell_ — almost always domain logic that should be an aggregate op, or trivial enough to inline. Allowing a util there would be a backdoor around the domain.

Two guards keep `*.util.ts` from drifting even within the interface layer:

1. **Test-obligated** — every `*.util.ts` requires a sibling `*.util.test.ts`.
2. **Leaf-only** — the manifest forbids a `*.util.ts` from importing ports, use cases, infrastructure, the buses or a module surface.

## Enforcement

- `architecture/structure` layout: `*.domain-service.ts` is in the `domain/domain-services/` allowlist; `*.util.ts` is in the `interface/http` and `interface/cli` allowlists only.
- Parity: `*.domain-service.ts` → `*.domain-service.test.ts`; `*.util.ts` → `*.util.test.ts`.
- `architecture/imports`: the util node's `reset: true` allowlist names only `zod`, `node:**` and the contracts. Domain services need no new rule — the domain allowlist already governs them (`node:crypto` is a builtin, admitted) and `domain/domain-services/` is excluded from subdomain isolation.

## Consequences

- The auth bounded context's "credentials are compared by hash" rule has one named, tested, discoverable home, and the authenticator and both device-grant commands import a _service_.
- The vocabulary gains exactly what it needed without loosening into a junk drawer.
- The application layer is provably free of shared-helper escape hatches.

## Supersedes / differs from the Effect edition

The PKCE codec decodes with a zod schema and `Buffer` rather than `Schema.fromJsonString`; everything else is a straight port.

## Alternatives considered

- **Fold `CredentialHash` onto `ApiTokenRootOps`.** Rejected — used by device-grant and the authenticator too.
- **Make credential generation a domain service too.** Rejected — impure.
- **Allow `*.util.ts` across all shell folders.** Rejected — the application layer is exactly where a shared helper masks anemic domain logic.
- **A single "shared helper" stereotype for both gaps.** Rejected — different layers, different risks.

## Related

- ADR-0001, ADR-0003, ADR-0008, ADR-0016/0017, ADR-0022.
