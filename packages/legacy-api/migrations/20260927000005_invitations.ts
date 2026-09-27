import type { Knex } from "knex";

exports.up = function (knex: Knex) {
  return knex.schema.createTable("invitations", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("organization_id")
      .notNullable()
      .references("id")
      .inTable("organizations")
      .onDelete("CASCADE");
    table.string("invitee_email", 320).notNullable();
    table.string("token", 64).notNullable().unique();
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("accepted_at", { useTz: true });
    table.timestamp("revoked_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["organization_id"]);
    table.index(["invitee_email"]);
  });
};

exports.down = function (knex: Knex) {
  return knex.schema.dropTable("invitations");
};
