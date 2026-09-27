import type { Knex } from "knex";

exports.up = function (knex: Knex) {
  return knex.schema.createTable("device_grants", (table) => {
    table.uuid("id").primary();
    table.text("device_code_hash").notNullable().unique();
    table.string("user_code", 32).notNullable().unique();
    table.string("status", 16).notNullable().defaultTo("pending");
    table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("approved_at", { useTz: true });
    table.index(["user_code"]);
  });
};

exports.down = function (knex: Knex) {
  return knex.schema.dropTable("device_grants");
};
