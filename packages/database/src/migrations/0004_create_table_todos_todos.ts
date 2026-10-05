import type { Knex } from "knex";

// organization_id points at the legacy API's organizations, which live in
// public until that module moves; the foreign key returns with it.
export const up = async (knex: Knex): Promise<void> => {
  await knex.raw(`
CREATE TABLE "todos"."todos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "completed" boolean DEFAULT false NOT NULL,
  "organization_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
)
  `);
  await knex.raw(`
CREATE INDEX "todos_organization_id_idx" ON "todos"."todos"("organization_id")
  `);
};
