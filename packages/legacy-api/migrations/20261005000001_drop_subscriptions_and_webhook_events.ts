import type { Knex } from "knex";

// The billing module is the Nest server's now (ADR-0035): its tables live in
// the `billing` schema the Nest migrator owns, and the legacy copies go once
// nothing here reads or writes them.
exports.up = async function (knex: Knex) {
  await knex.schema.dropTableIfExists("webhook_events");
  await knex.schema.dropTableIfExists("subscriptions");
};

exports.down = async function (knex: Knex) {
  await knex.schema.createTable("subscriptions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("organization_id")
      .notNullable()
      .unique()
      .references("id")
      .inTable("organizations")
      .onDelete("CASCADE");
    table.text("stripe_customer_id").notNullable();
    table.text("stripe_subscription_id").notNullable().unique();
    table.text("status").notNullable();
    table.timestamp("current_period_end", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable("webhook_events", (table) => {
    table.text("stripe_event_id").primary();
    table.timestamp("received_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};
