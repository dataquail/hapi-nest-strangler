import type { Knex } from "knex";

// organization_id is a plain uuid: the organization row lives in the legacy
// API's database schema, and a foreign key across services is a coupling the
// strangler exists to remove.
export const up = async (knex: Knex): Promise<void> => {
  await knex.raw(`
CREATE TABLE "wallet"."wallets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "balance" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wallets_organization_id_unique" UNIQUE("organization_id")
)
  `);
};
