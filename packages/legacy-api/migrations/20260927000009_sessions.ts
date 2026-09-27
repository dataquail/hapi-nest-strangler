import type { Knex } from "knex";

exports.up = function (knex: Knex) {
  return knex.schema.createTable("sessions", (table) => {
    table.uuid("id").primary();
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("subject", 128).notNullable();
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("absolute_expires_at", { useTz: true }).notNullable();
    table.timestamp("revoked_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("last_used_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["user_id"]);
    table.index(["expires_at"]);
  });
};

exports.down = function (knex: Knex) {
  return knex.schema.dropTable("sessions");
};
