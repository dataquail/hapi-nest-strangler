import type { Knex } from "knex";

exports.up = function (knex: Knex) {
  return knex.schema.createTable("auth_identities", (table) => {
    table.string("subject", 128).primary();
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("provider", 32).notNullable().defaultTo("zitadel");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["user_id"]);
  });
};

exports.down = function (knex: Knex) {
  return knex.schema.dropTable("auth_identities");
};
