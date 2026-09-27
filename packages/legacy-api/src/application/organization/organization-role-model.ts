import type Bookshelf from "bookshelf";

export default (_bookshelf: Bookshelf) => ({
  tableName: "organization_roles",
  idAttribute: null,
  requireFetch: false,
});
