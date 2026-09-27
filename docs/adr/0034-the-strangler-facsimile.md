# ADR-0034: The strangler facsimile — two servers, one database, an HTTP seam

- Status: Accepted
- Date: 2026-09-27

## Context and Problem Statement

`nest-domain-driven-hexagon` is a finished destination: every module already lives in the hexagonal layout the manifest enforces, so a campaign that measures a migration _toward_ that layout has nothing to measure. The goodbones campaigns tooling needs a repository at the moment a strangler-fig migration has only just begun — an old server that owns almost everything, a new server that owns one module, and a seam between them that a real migration would have.

This repository is that facsimile. The question it answers is how to build one that is honest enough to exercise the tooling — real coupling, real transactions across the seam, real tests — without inventing a second product.

## Decision

**One application, two servers, one database.** The behaviour is the Nest edition's, unchanged: users, roles, auth (OIDC through Zitadel, sessions, API tokens, the device flow), organizations with memberships, invitations and admin roles, todos, billing, and a wallet opened for every organization. What changed is who serves it.

- `packages/legacy-api` (`@org/legacy-api`) is a **hapi** server that owns everything but the wallet. It is written in the shape of a long-lived production hapi codebase, on purpose: routes and services per feature folder, services as classes holding the business logic and reaching each other directly, bookshelf models, an electrolyte string-id container no import graph can see, a virgen-acl permission tree consulted from route pre-handlers, and every table in the `public` schema. It follows none of the Nest server's conventions and has its own rule file. Its shape is the thing the campaign measures; refactoring it in place would erase the measurement.
- `packages/server` (`@org/server`) is the Nest server of the previous edition **reduced to the wallet module**, with its taxonomy, kernel packages and manifest intact. It is the destination architecture, kept whole so that vacancy and slack in its manifest read as the strangler's progress meter (ADR-0030).
- The browser, the CLI and the MCP server talk to the hapi server. The web renderer's `/api/*` proxy points at `:9000`; the `openapi-fetch` clients default to it. The Nest server has no browser-facing route.

**The seam is HTTP with compensation, not a shared transaction.** The Nest server exposes an internal API (`/internal/wallets`, ADR-0010's contracts package carries it as `InternalApi`) guarded by an HS256 inter-service JWT that both servers derive from `INTER_SERVICE_JWT_SECRET`. Creating an organization on the hapi side opens the wallet _inside_ the hapi transaction: a refusal from the wallet service rolls the organization back and answers `502 BadGateway`; a failure after the wallet opened deletes it again, best effort, before the error propagates. The Nest side's delete is idempotent so the compensation can be retried. This is the coupling a real migration carries — a distributed write with a manual undo — and the campaign should see it.

**Two migrators share the database.** The hapi server's knex migrator owns the default `knex_migrations` table and every `public` table. The Nest server's migrator tracks its own history in `knex_migrations_nest` and owns the `wallet` schema alone. A reset on either side leaves the other's tables standing. There is no foreign key across the seam: a wallet row names its organization by id and nothing else.

**The contracts package is the shared vocabulary.** Both servers implement `@org/contracts`: the hapi server serves `DomainApi` and `CliApi`, the Nest server serves `InternalApi`. The hapi routes are hand-written, so a unit test on the hapi side (`test/route-parity.test.ts`) composes the server and asserts that its route table is exactly the contracts' domain and CLI routes, plus its health check, and that it serves none of the internal routes. The wire error shape (`{ _tag, message, … }`) is preserved by tagging every Boom the hapi server raises, so the web's error handling is unchanged.

**The suites are split by server, then by kind.** The hapi package has `*.spec.ts` unit tests beside its services and `test/**/*.integration.test.ts` over the composed server and a real database, with an in-process fake wallet server and a fake identity provider. The Nest package keeps ADR-0009's pyramid for the wallet. The acceptance suite boots both servers and the web against the test database and drives the browser; one spec creates an organization and asserts the wallet row on the Nest side.

## Consequences

- The manifest's coverage floors and conformance ceilings had to be re-recorded downward as the open hapi package grew, and the fake-file orphan exemption written for the Nest tree swallowed a hapi file with a matching name. Each of these is logged in `docs/plan/goodbones-findings.md`; the log, not this ADR, is the deliverable the tooling team reads.
- `@org/jobs` was removed; the one job it carried belongs to the module that moved. The purge of expired sessions is a hapi bin.
- The hapi package depends on nothing from the Nest side except the contracts. The root graph rules refuse an import in either direction between the servers, and the hapi node's own allowlist refuses the kernel packages in the editor.
- The next engagement writes the strangler campaign itself into `architecture.yaml`: which files count as legacy, which module leaves next, and how progress is measured. Nothing in this repository should be tidied ahead of it.

## References

- `docs/plan/strangler-facsimile-plan.md` — the plan the facsimile followed, step by step.
- `docs/plan/goodbones-findings.md` — what the tooling got wrong or made hard while it was built.
- ADR-0033 — the port this repository is derived from.
