import type Bookshelf from "bookshelf";

export default (_bookshelf: Bookshelf) => ({
  tableName: "webhook_events",
  idAttribute: "stripe_event_id",
  requireFetch: false,
});
