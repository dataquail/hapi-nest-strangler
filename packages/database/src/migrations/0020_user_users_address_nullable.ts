import type { Knex } from "knex";

export const up = async (knex: Knex): Promise<void> => {
  await knex.raw(`
ALTER TABLE "user".users ALTER COLUMN country DROP NOT NULL
  `);
  await knex.raw(`
ALTER TABLE "user".users ALTER COLUMN street DROP NOT NULL
  `);
  await knex.raw(`
ALTER TABLE "user".users ALTER COLUMN postal_code DROP NOT NULL
  `);
};
