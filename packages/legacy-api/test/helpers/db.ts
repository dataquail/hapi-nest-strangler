import type { Knex } from "knex";

import { assertTestDatabase, connect } from "../../src/lib/migrator";

let shared: Knex | undefined;

export const getKnex = (): Knex => {
  shared ??= connect(assertTestDatabase(process.env.DATABASE_URL_TEST));
  return shared;
};

export const closeKnex = async (): Promise<void> => {
  await shared?.destroy();
  shared = undefined;
};

// Every application table in public, in one statement, leaving both
// migrators' history tables alone.
export const truncateAll = async (): Promise<void> => {
  await getKnex().raw(`
    DO $$
    DECLARE tablenames text;
    BEGIN
      tablenames := string_agg('"' || tablename || '"', ', ')
        FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'knex_migrations%';
      IF tablenames IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || tablenames || ' CASCADE';
      END IF;
    END; $$`);
};
