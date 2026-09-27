# ADR-0020: Per-module database schemas

- Status: Accepted
- Date: 2026-05-18
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context

ADR-0002 establishes hexagonal modules with sealed boundaries: cross-module access flows through each module's `<feature>.exports.ts` / `<feature>.imports.ts` gateways at the type level (ADR-0032) and through the buses at runtime (ADR-0006, ADR-0007). The manifest enforces the TypeScript boundary; the buses provide the runtime ACL. There must be an equivalent enforcement at the persistence layer.

If every module's tables lived in a shared `public` schema and every repository wrote `SELECT * FROM users` / `INSERT INTO wallets …`, two failure modes follow:

1. **Implicit cross-module reads in SQL are undetectable.** A handler in `modules/wallet/` writing `SELECT … FROM users JOIN wallets …` is a physical violation of the module boundary that nothing would flag — not the import rules (no import to inspect), not the bus (no dispatch to observe), not tests (the query succeeds against a shared schema).
2. **No structural reminder of ownership.** Unqualified table names invite "all tables are equally available."

Both failure modes exist only because the persistence layer is undivided.

## Decision

### Each module owns a Postgres schema

Each feature module owns a Postgres schema; application SQL addresses tables by their owning schema. The one non-eponymous case is roles: they are platform-level data, so the `role` module's table lives in a shared `platform` schema.

| Module folder  | Schema         | Tables                                                                              |
| -------------- | -------------- | ----------------------------------------------------------------------------------- |
| `user`         | `user`         | `user.users`                                                                        |
| `organization` | `organization` | `organization.organizations`, `.memberships`, `.invitations`, `.organization_roles` |
| `todos`        | `todos`        | `todos.todos`                                                                       |
| `wallet`       | `wallet`       | `wallet.wallets`                                                                    |
| `auth`         | `auth`         | `auth.auth_identities`, `auth.sessions`, `auth.api_tokens`, `auth.device_grants`    |
| `billing`      | `billing`      | `billing.subscriptions`, `billing.webhook_events`                                   |
| `role`         | `platform`     | `platform.roles` (platform-level, cross-cutting)                                    |

Migrations live in `packages/database/src/migrations/` as one-thing-per-file TypeScript modules (ADR-0011): `0001_create_schema_user.ts`, `0007_create_table_user_users.ts`, etc. FK dependencies dictate the order.

### All application SQL must be schema-qualified

Repositories, query handlers, jobs, and any other SQL site must address tables by their owning schema: `"user".users`, `todos.todos`, `wallet.wallets`, `auth.auth_identities`, `platform.roles`. The double-quotes on `"user"` are required because `user` is a Postgres reserved word.

### Cross-schema foreign keys are allowed at DDL only

Postgres permits FKs across schemas, and we keep a handful as a physical safety net against orphans — chiefly the several `*.user_id → user.users.id ON DELETE CASCADE` references. This is the **only** cross-schema reference we tolerate. Application SQL must never JOIN, SELECT, INSERT, UPDATE, or DELETE across schemas. Reads across module boundaries flow through the buses (ADR-0006), the ACL ports (ADR-0022) and the event adapters (ADR-0007).

### Static enforcement via `local/no-cross-schema-sql-access`

The rule (`scripts/lint-rules/no-cross-schema-sql-access.mjs`, enabled in `.oxlintrc.json`) applies to any non-test file under `packages/server/src/modules/<name>/`. It requires fully-qualified table names in `sql` tagged templates and forbids access to any schema other than the one that module owns — reading quoted identifiers (`"user".users`), consulting a small map for modules whose schema is named differently (`role` owns `platform`), and ignoring set-returning functions and CTE names, which are not tables. It recognises every form the slonik tag takes here — bare `sql`, `sql.type(RowSchema)`, `sql.fragment` and `sql.unsafe` — because a rule that matched only the bare tag would have been vacuous on every typed query in the repo (ADR-0025).

`packages/server/src/test-utils/` and `packages/jobs/src/test-utils/` are **not** scoped by the rule — they legitimately TRUNCATE across schemas to reset state between tests. Integration tests are excluded for the same reason: a `wallet` test seeds a `user.users` row through `@org/database` rather than the user repository.

### Test harness convention

`truncate(db, "schema.table", …)` in both test-utils packages requires qualified strings; mis-qualified inputs throw at runtime with an explanatory message. The test runtime drops every module schema before replaying migrations from scratch. `MODULE_SCHEMAS` lives once, in `packages/database/src/migrator.ts`, and every harness (server, jobs, acceptance) calls that package's `resetAndMigrate`; adding a module means one migration and one entry there.

## Consequences

**Positive**

- Cross-module persistence coupling is flagged at lint time, joining imports (the manifest) and runtime (the buses) in the boundary-enforcement set.
- The ownership of a table is visible in every query.
- Migration files are scoped: each file does one DDL action.

**Negative / trade-offs**

- Adding a table to an existing module still requires a `create_table_*` migration and, if a FK to another module's table is needed, a migration that references the foreign schema explicitly.
- A new module requires a `create_schema_<name>` migration and an entry in `MODULE_SCHEMAS`.
- Down migrations are deliberately not authored (ADR-0011).

## Supersedes / differs from the Effect edition

The rule now understands slonik's tag forms instead of effect/sql's; `MODULE_SCHEMAS` lives in the database package rather than being duplicated per harness. The boundary and the schema table are unchanged.

## Alternatives considered

- **Schemas + drop cross-schema FKs entirely.** Rejected: a wallet without a user is a money-shaped bug.
- **No schemas; rely on a rule that parses SQL strings for table names alone.** Rejected: parsing arbitrary tagged-template SQL is fragile and would not catch dynamic identifiers. Per-module schemas make the constraint structural.
- **slonik's `sql.identifier` everywhere with a per-module schema constant.** Rejected — it hides the schema behind an indirection at exactly the point the ADR wants it visible.

## Related

- ADR-0002, ADR-0007, ADR-0008, ADR-0011, ADR-0025.
