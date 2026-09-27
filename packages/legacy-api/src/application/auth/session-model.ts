import type Bookshelf from "bookshelf";

export default (_bookshelf: Bookshelf) => ({
  tableName: "sessions",
  idAttribute: "id",
  requireFetch: false,

  user(this: any) {
    return this.belongsTo("user", "user_id");
  },
});
