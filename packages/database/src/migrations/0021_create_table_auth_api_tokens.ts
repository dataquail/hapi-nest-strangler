import type { Knex } from "knex";

export const up = async (knex: Knex): Promise<void> => {
  await knex.raw(`
CREATE TABLE "auth"."api_tokens" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "user"."users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "prefix" varchar(64) NOT NULL,
  "label" varchar(255) NOT NULL,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone NOT NULL DEFAULT now()
)
  `);
  await knex.raw(`
CREATE INDEX "api_tokens_user_id_idx" ON "auth"."api_tokens"("user_id")
  `);
};
