import type { Knex } from "knex";

export const up = async (knex: Knex): Promise<void> => {
  await knex.raw(`
CREATE TABLE "auth"."auth_identities" (
  "subject" varchar(128) PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "user"."users"("id") ON DELETE CASCADE,
  "provider" varchar(32) NOT NULL DEFAULT 'zitadel',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
)
  `);
  await knex.raw(`
CREATE INDEX "auth_identities_user_id_idx" ON "auth"."auth_identities"("user_id")
  `);
};
