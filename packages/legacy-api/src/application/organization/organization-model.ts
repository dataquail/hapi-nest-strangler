import type Bookshelf from "bookshelf";

import { resourceConstants } from "../../constants/acl/resource-constants";

// Soft-deleted rows stay in the table with deleted_at set; every reader that
// must hide them filters by hand.
export default (_bookshelf: Bookshelf) => ({
  tableName: "organizations",
  idAttribute: "id",
  hasTimestamps: ["created_at", "updated_at"],
  requireFetch: false,

  memberships(this: any) {
    return this.hasMany("membership", "organization_id");
  },

  invitations(this: any) {
    return this.hasMany("invitation", "organization_id");
  },

  getResourceId(): string {
    return resourceConstants.ORGANIZATION;
  },

  isDeleted(this: any): boolean {
    return this.get("deleted_at") !== null && this.get("deleted_at") !== undefined;
  },
});
