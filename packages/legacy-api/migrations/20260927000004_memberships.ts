import type { Knex } from "knex";

exports.up = function (knex: Knex) {
  return knex.schema.createTable("memberships", (table) => {
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table
      .uuid("organization_id")
      .notNullable()
      .references("id")
      .inTable("organizations")
      .onDelete("CASCADE");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(["user_id", "organization_id"]);
    table.index(["organization_id"]);
  });
};

exports.down = function (knex: Knex) {
  return knex.schema.dropTable("memberships");
};
