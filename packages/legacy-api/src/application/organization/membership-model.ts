import type Bookshelf from "bookshelf";

export default (_bookshelf: Bookshelf) => ({
  tableName: "memberships",
  idAttribute: null,
  requireFetch: false,

  user(this: any) {
    return this.belongsTo("user", "user_id");
  },

  organization(this: any) {
    return this.belongsTo("organization", "organization_id");
  },
});
