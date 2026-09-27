import type Bookshelf from "bookshelf";

// Composite key (user_id, role); read through the user relation, written with knex.
export default (_bookshelf: Bookshelf) => ({
  tableName: "roles",
  idAttribute: null,
  requireFetch: false,

  user(this: any) {
    return this.belongsTo("user", "user_id");
  },
});
