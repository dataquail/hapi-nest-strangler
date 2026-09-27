import { createDatabase, type Database, resetAndMigrate, sql } from "@org/database";

const rawUrl = process.env.DATABASE_URL_TEST;
export const TEST_DATABASE_URL: string | undefined =
  rawUrl !== undefined && rawUrl.length > 0 ? rawUrl : undefined;

export const assertTestDatabaseConfigured = (): string => {
  if (TEST_DATABASE_URL === undefined) {
    throw new Error(
      "[test-database] integration tests require DATABASE_URL_TEST to be set. " +
        "Start the test database and export DATABASE_URL_TEST (its name must contain 'test').",
    );
  }
  const name = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  if (!name.toLowerCase().includes("test")) {
    throw new Error(
      `[test-database] refusing to operate on '${name}' — DATABASE_URL_TEST name must contain 'test'`,
    );
  }
  return TEST_DATABASE_URL;
};

let migrationsPromise: Promise<void> | undefined;

// Migration replay is destructive (every module schema is dropped), which is why
// the URL is checked for `test` before anything runs.
export const runTestMigrations = (): Promise<void> => {
  migrationsPromise ??= resetAndMigrate({ url: assertTestDatabaseConfigured(), ssl: false }).then(
    () => undefined,
  );
  return migrationsPromise;
};

export const createTestDatabase = (): Promise<Database> =>
  createDatabase({ url: assertTestDatabaseConfigured(), ssl: false, maximumPoolSize: 4 });

const splitQualified = (qualified: string): readonly [string, string] => {
  const [schema, table, ...rest] = qualified.split(".");
  if (schema === undefined || table === undefined || rest.length > 0) {
    throw new Error(
      `[truncate] expected "schema.table", got "${qualified}". Tests must qualify table names with their owning module schema.`,
    );
  }
  return [schema, table];
};

export const truncate = async (db: Database, ...tables: ReadonlyArray<string>): Promise<void> => {
  for (const qualified of tables) {
    const [schema, table] = splitQualified(qualified);
    await db.exec(sql.unsafe`TRUNCATE TABLE ${sql.identifier([schema, table])} CASCADE`);
  }
};
