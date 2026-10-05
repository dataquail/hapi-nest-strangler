import knex, { type Knex } from "knex";

import { type MigrationModule, migrations } from "./migrations/index.js";

export type MigratorConfig = {
  readonly url: string;
  readonly ssl: boolean;
};

// ADR-0020: each module of the Nest server owns a Postgres schema named after
// its folder. Every table not listed here is the legacy API's, in `public`,
// and arrives schema by schema as the strangler moves a module across.
// Adding a module means a migration and an entry here.
export const MODULE_SCHEMAS = ["wallet", "todos"] as const;

// Not the default name: the legacy API's migrator owns `knex_migrations` in
// the same database, and neither history may read, or drop, the other's.
const MIGRATIONS_TABLE = "knex_migrations_nest";

type Spec = { readonly name: string; readonly module: MigrationModule };

const forwardOnly = (name: string) => (): Promise<void> =>
  Promise.reject(new Error(`Migration ${name} is forward-only (ADR-0011); there is no down`));

// knex's own loader discovers files on disk and imports them dynamically, which
// a test runner's transform does not see. A static record keeps one mechanism
// for the CLI, the suites and acceptance alike.
export const migrationSource: Knex.MigrationSource<Spec> = {
  getMigrations: () =>
    Promise.resolve(Object.entries(migrations).map(([name, module]) => ({ name, module }))),
  getMigrationName: (spec) => spec.name,
  getMigration: (spec) =>
    Promise.resolve({
      up: spec.module.up,
      down: forwardOnly(spec.name),
    }),
};

const connect = (config: MigratorConfig): Knex =>
  knex({
    client: "pg",
    connection: {
      connectionString: config.url,
      ssl: config.ssl ? { rejectUnauthorized: true } : false,
    },
    pool: { min: 0, max: 2 },
  });

export type AppliedMigrations = ReadonlyArray<string>;

export const runMigrations = async (config: MigratorConfig): Promise<AppliedMigrations> => {
  const db = connect(config);
  try {
    const [, applied] = (await db.migrate.latest({
      migrationSource,
      tableName: MIGRATIONS_TABLE,
    })) as [number, Array<string>];
    return applied;
  } finally {
    await db.destroy();
  }
};

// Test replay: every run starts from empty module schemas, so there is no
// history to reconcile — dropping the history table alongside them is what makes
// the migrator re-apply everything.
export const resetAndMigrate = async (config: MigratorConfig): Promise<AppliedMigrations> => {
  const db = connect(config);
  try {
    for (const schema of MODULE_SCHEMAS) {
      await db.raw(`DROP SCHEMA IF EXISTS ?? CASCADE`, [schema]);
    }
    await db.raw(`DROP TABLE IF EXISTS ??`, [MIGRATIONS_TABLE]);
    await db.raw(`DROP TABLE IF EXISTS ??`, [`${MIGRATIONS_TABLE}_lock`]);
  } finally {
    await db.destroy();
  }
  return runMigrations(config);
};
