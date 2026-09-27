import type { Knex } from "knex";

exports.up = function (knex: Knex) {
  return knex.schema.createTable("roles", (table) => {
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("role", 32).notNullable();
    table.timestamp("granted_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(["user_id", "role"]);
  });
};

exports.down = function (knex: Knex) {
  return knex.schema.dropTable("roles");
};
