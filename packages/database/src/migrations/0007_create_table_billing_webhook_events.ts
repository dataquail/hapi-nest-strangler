import type { Knex } from "knex";

export const up = async (knex: Knex): Promise<void> => {
  await knex.raw(`
CREATE TABLE "billing"."webhook_events" (
  "stripe_event_id" text PRIMARY KEY NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL
)
  `);
};
