import type { Knex } from "knex";

exports.up = function (knex: Knex) {
  return knex.schema.createTable("subscriptions", (table) => {
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
};

exports.down = function (knex: Knex) {
  return knex.schema.dropTable("subscriptions");
};
