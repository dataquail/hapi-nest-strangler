import knex, { type Knex } from "knex";
import path from "path";

// The legacy migrator owns the default `knex_migrations` table: it was here
// first. The Nest server's migrator tracks its own schema in a table of its
// own, so the two can share a database without reading each other's history.
const MIGRATIONS_TABLE = "knex_migrations";

// Migration files are required by knex at run time, so they carry the
// extension of whatever is running: `.ts` from source, `.js` from build/.
const extension = path.extname(__filename);

export const migrationConfig = (): Knex.MigratorConfig => ({
  directory: path.join(__dirname, "../../migrations"),
  tableName: MIGRATIONS_TABLE,
  loadExtensions: [extension],
});

export const connect = (connection: string): Knex =>
  knex({ client: "pg", connection, pool: { min: 0, max: 2 } });

export const assertTestDatabase = (url: string | undefined): string => {
  if (!url) {
    throw new Error("DATABASE_URL_TEST is not set (its name must contain 'test')");
  }
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.toLowerCase().includes("test")) {
    throw new Error(`refusing to operate on '${name}': DATABASE_URL_TEST name must contain 'test'`);
  }
  return url;
};

export const runMigrations = async (connection: string): Promise<string[]> => {
  const db = connect(connection);
  try {
    const [, applied] = (await db.migrate.latest(migrationConfig())) as [number, string[]];
    return applied;
  } finally {
    await db.destroy();
  }
};

// Drops every table in `public` except the Nest migrator's own history, so a
// replay starts from nothing without touching the schema the other server owns.
export const dropPublicTables = async (connection: string): Promise<void> => {
  const db = connect(connection);
  try {
    const rows = await db
      .select<{ tablename: string }[]>("tablename")
      .from("pg_tables")
      .where({ schemaname: "public" })
      .whereNot("tablename", "like", "knex_migrations_nest%");
    for (const { tablename } of rows) {
      await db.raw(`DROP TABLE IF EXISTS ?? CASCADE`, [tablename]);
    }
  } finally {
    await db.destroy();
  }
};

export const resetAndMigrate = async (connection: string): Promise<string[]> => {
  await dropPublicTables(connection);
  return runMigrations(connection);
};
