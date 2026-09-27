import type Bookshelf from "bookshelf";

import { resourceConstants } from "../../constants/acl/resource-constants";

export default (_bookshelf: Bookshelf) => ({
  tableName: "subscriptions",
  idAttribute: "id",
  hasTimestamps: ["created_at", "updated_at"],
  requireFetch: false,

  organization(this: any) {
    return this.belongsTo("organization", "organization_id");
  },

  getResourceId(): string {
    return resourceConstants.SUBSCRIPTION;
  },
});
