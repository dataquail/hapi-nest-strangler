import type Bookshelf from "bookshelf";

export default (_bookshelf: Bookshelf) => ({
  tableName: "auth_identities",
  idAttribute: "subject",
  requireFetch: false,

  user(this: any) {
    return this.belongsTo("user", "user_id");
  },
});
