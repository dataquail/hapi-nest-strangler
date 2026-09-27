import { createDatabase, type Database, resetAndMigrate, sql } from "@org/database";

const rawUrl = process.env.DATABASE_URL_TEST;
export const TEST_DATABASE_URL: string | undefined =
  rawUrl !== undefined && rawUrl.length > 0 ? rawUrl : undefined;

export const assertTestDatabaseConfigured = (): string => {
  if (TEST_DATABASE_URL === undefined) {
    throw new Error(
      "[test-database] integration tests require DATABASE_URL_TEST to be set (its name must contain 'test').",
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

export const runTestMigrations = (): Promise<void> => {
  migrationsPromise ??= resetAndMigrate({ url: assertTestDatabaseConfigured(), ssl: false }).then(
    () => undefined,
  );
  return migrationsPromise;
};

export const createTestDatabase = (): Promise<Database> =>
  createDatabase({ url: assertTestDatabaseConfigured(), ssl: false, maximumPoolSize: 4 });

export const truncate = async (db: Database, ...tables: ReadonlyArray<string>): Promise<void> => {
  for (const qualified of tables) {
    const [schema, table] = qualified.split(".");
    if (schema === undefined || table === undefined)
      throw new Error(`[truncate] expected "schema.table", got "${qualified}"`);
    await db.exec(sql.unsafe`TRUNCATE TABLE ${sql.identifier([schema, table])} CASCADE`);
  }
};
