import type { Knex } from "knex";

exports.up = function (knex: Knex) {
  return knex.schema.createTable("webhook_events", (table) => {
    table.text("stripe_event_id").primary();
    table.timestamp("received_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function (knex: Knex) {
  return knex.schema.dropTable("webhook_events");
};
