import type { Knex } from "knex";

exports.up = function (knex: Knex) {
  return knex.schema.createTable("organization_roles", (table) => {
    table
      .uuid("organization_id")
      .notNullable()
      .references("id")
      .inTable("organizations")
      .onDelete("CASCADE");
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("role", 32).notNullable();
    table.uuid("issued_by").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(["organization_id", "user_id", "role"]);
    table.index(["user_id", "organization_id"]);
  });
};

exports.down = function (knex: Knex) {
  return knex.schema.dropTable("organization_roles");
};
