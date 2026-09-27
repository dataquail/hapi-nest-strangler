import type { Knex } from "knex";

export const up = async (knex: Knex): Promise<void> => {
  await knex.raw(`
CREATE TABLE "auth"."device_grants" (
  "id" uuid PRIMARY KEY,
  "device_code_hash" text NOT NULL UNIQUE,
  "user_code" varchar(32) NOT NULL UNIQUE,
  "status" varchar(16) NOT NULL DEFAULT 'pending',
  "user_id" uuid REFERENCES "user"."users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  "approved_at" timestamp with time zone
)
  `);
  await knex.raw(`
CREATE INDEX "device_grants_user_code_idx" ON "auth"."device_grants"("user_code")
  `);
};
