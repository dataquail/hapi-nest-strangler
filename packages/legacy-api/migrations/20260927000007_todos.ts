import type { Knex } from "knex";

exports.up = function (knex: Knex) {
  return knex.schema.createTable("todos", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.text("title").notNullable();
    table.boolean("completed").notNullable().defaultTo(false);
    table
      .uuid("organization_id")
      .notNullable()
      .references("id")
      .inTable("organizations")
      .onDelete("CASCADE");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["organization_id"]);
  });
};

exports.down = function (knex: Knex) {
  return knex.schema.dropTable("todos");
};
