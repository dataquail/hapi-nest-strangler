import type { Knex } from "knex";

exports.up = function (knex: Knex) {
  return knex.schema.createTable("organizations", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("name", 255).notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at", { useTz: true });
  });
};

exports.down = function (knex: Knex) {
  return knex.schema.dropTable("organizations");
};
