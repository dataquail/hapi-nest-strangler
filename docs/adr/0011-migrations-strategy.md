# ADR-0011: Migrations — forward-only TypeScript modules

- Status: Accepted
- Date: 2026-04-24
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

Schema migrations have to be reviewable, deterministic in tests, and honest about how rollback actually works in production.

The forces:

- A migration's effect on the database should be visible in the diff. Generated SQL hidden behind ORM abstractions has historically been a source of "I didn't realize that migration would do that" production incidents.
- Tests need a deterministic schema each run. Flakiness from leftover state across runs is demoralizing.
- Production rollback is rarely "run the down migration and pretend nothing happened." Real production rollback is a forward operation: write a new migration that undoes the harm, deploy, observe. Symmetric up/down pairs encode a fiction about how production actually works.
- Concurrent feature branches will sometimes both add a migration. Ordering ambiguity must surface as a merge conflict, not silently resolve in either direction.

## Decision

- Migrations are **forward-only TypeScript modules** in `packages/database/src/migrations/`, named `<nnnn>_<description>.ts` (`<nnnn>` a zero-padded monotonically increasing integer, e.g. `0001_`, `0002_`). Each exports one function, `up(knex)`, that issues its DDL through `knex.raw` — the SQL stays literal in the file. Each file does **one logical DDL change** — one `CREATE SCHEMA`, one `CREATE TABLE` plus its indexes, one `ALTER` group — which eases review and history (ADR-0020).
- No down migrations. On a template repo the convention is to wipe and replay rather than incrementally roll back. To reverse a migration in any environment, write a new forward migration that undoes it. The migration source hands knex a `down` that rejects with the ADR's name, so a stray `knex migrate:rollback` fails loudly rather than silently doing nothing.
- The runner is knex's programmatic migrator (`packages/database/src/migrator.ts`), driven from `pnpm --filter @org/database db:migrate`; `db:migrate:test` targets the test database.
- The loader is a **static `MigrationSource`** fed by a hand-maintained `src/migrations/index.ts` that imports every module by name. knex's own filesystem loader imports files dynamically at run time, which a test runner's transform does not see, so a `.ts` migration would fail to load under vitest. A static record is the one mechanism that works for the CLI, both test suites and acceptance alike; `migrator.test.ts` asserts the record matches the directory, so a file nobody registered fails rather than silently never running.
- **Sequential integers, not timestamps.** knex applies pending migrations in name order and records each in `knex_migrations`; a lower-numbered migration merged after a higher one would still run, but the two branches' files would sort into an order neither author reviewed. Sequential numbering turns the collision into a merge conflict on the next number instead — the same forcing function the original decision valued.
- Production runtime applies migrations at deploy time. The exact mechanism — startup hook vs. out-of-band command — is deferred and revisited when production deployment is in scope.
- The test runtime drops every module schema **and the migration history table**, then replays every file. Test databases want a deterministic schema, not drift detection, so the history is discarded rather than reconciled.

### Layout

Migrations and the database kernel that consumes them live together in a dedicated package (no application logic — only connection setup, migration files, and shared row schemas):

```
packages/database/src/
  database.ts          — createDatabase: the slonik pool, the ambient transaction, sql
  errors.ts            — DatabaseError / DatabaseUnavailable, translateDatabaseError
  migrator.ts          — the static MigrationSource, runMigrations, resetAndMigrate, MODULE_SCHEMAS
  migrations/
    index.ts           — the record the MigrationSource consumes
    0001_create_schema_user.ts
    0002_create_schema_organization.ts
    ...
  row-schemas/         — zod row schemas shared by infrastructure repositories and query handlers
  scripts/             — migrate.ts, reset-database.ts (the pnpm db:* entrypoints)
```

Migrations sit under `src/` so `tsc` typechecks them and they compile alongside everything else — a migration with a syntax error fails the build, not the deploy.

A migration reads:

```ts
// src/migrations/0001_create_schema_user.ts
import type { Knex } from "knex";

export const up = async (knex: Knex): Promise<void> => {
  await knex.raw(`CREATE SCHEMA "user"`);
};
```

Each module owns a Postgres schema named after its folder; migrations create those schemas and their tables, ordered so every `CREATE SCHEMA` lands before any `CREATE TABLE` that targets it, and any cross-schema FK is numbered after the table it references (ADR-0020).

### Test replay semantics

`resetAndMigrate` drops every schema in `MODULE_SCHEMAS` plus `knex_migrations` and its lock table, then runs the migrator. The server, jobs and acceptance harnesses all call it — one implementation, so every entry point agrees on one history table and a replay leaves a database that `db:migrate` correctly reports as up to date.

Memoized in each harness so concurrent test files that each call `runTestMigrations` in `beforeAll` don't race. The destructive drop is gated by the test-database name guard (ADR-0009).

## Consequences

- Every schema change is explicit SQL, reviewable as plain text in the PR. No surprises from a generator inferring an intent that wasn't yours.
- Test runs are fully reproducible: each run starts from empty module schemas. No truncate-and-reseed rituals; no "passes locally, fails in CI" rooted in residual state.
- Migration ordering is by filename numeric prefix. Two branches that both add a migration with the next number must rebase one onto the other before merge — a feature, not a defect: it forces an explicit decision about ordering.
- No automated rollback. A botched production migration is rolled forward, not backward. This pushes useful discipline into migration design: separate a column drop from the code that stops reading it; do additive changes first, destructive changes after read traffic stops; deploy in stages so a partial rollback is itself a forward migration plus a code revert.
- The runner records what it has applied in `knex_migrations`, so a repeat run against a live database is a no-op and only pending files execute. A database whose schema predates that table has to be replayed once (`db:reset` then `db:migrate`); there is no baselining path, which is acceptable because no environment here holds data worth preserving.

## Supersedes / differs from the Effect edition

`@effect/sql`'s `Migrator` and its `effect_sql_migrations` table → knex's programmatic migrator and `knex_migrations`; a default-exported `Effect` per file → a named `up(knex)`; `Migrator.fromRecord` → a static `Knex.MigrationSource` over the same hand-maintained record. The reasons for a static record, for forward-only, and for sequential integers are unchanged; knex merely gains an explicit rejecting `down` where the Effect migrator had no such concept at all.

## Alternatives considered

- **ORM-driven auto-migrations.** Rejected — generated SQL is too easy to push without inspection. The whole reason for plain SQL files is so the diff is the migration.
- **Reversible up/down migrations.** Rejected. knex supports `down`, which is why the source rejects it explicitly: a "down" migration to drop a column doesn't restore the data "up" put there, and writing symmetric pairs encourages overconfidence in production reversibility.
- **knex's schema builder (`knex.schema.createTable(...)`).** Rejected — it is the generator the first alternative rejects, in miniature. `knex.raw` keeps the diff as the migration.
- **Plain `.sql` files.** Rejected for the same reason as before: the SQL stays just as visible inside `knex.raw`, while a module can also loop, branch, or move data when a schema change needs a backfill ordered against it.
- **Per-environment seed scripts as part of migration.** Rejected — seeds are environment data, not schema. Conflating them complicates promotion of the same migration file across environments.

## Related

- ADR-0005 (repository pattern) — uses the database client that the migrations target.
- ADR-0009 (testing pyramid) — the test database safety guard works in concert with the destructive replay semantics.
- ADR-0020 (per-module database schemas) — the schema-per-module boundary these migrations create and the one-DDL-per-file convention.
