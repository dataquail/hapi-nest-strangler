import type Bookshelf from "bookshelf";

export default (_bookshelf: Bookshelf) => ({
  tableName: "device_grants",
  idAttribute: "id",
  requireFetch: false,
});
