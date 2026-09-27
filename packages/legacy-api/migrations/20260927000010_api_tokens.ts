import type { Knex } from "knex";

exports.up = function (knex: Knex) {
  return knex.schema.createTable("api_tokens", (table) => {
    table.uuid("id").primary();
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.text("token_hash").notNullable().unique();
    table.string("prefix", 64).notNullable();
    table.string("label", 255).notNullable();
    table.timestamp("expires_at", { useTz: true });
    table.timestamp("revoked_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("last_used_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["user_id"]);
  });
};

exports.down = function (knex: Knex) {
  return knex.schema.dropTable("api_tokens");
};
