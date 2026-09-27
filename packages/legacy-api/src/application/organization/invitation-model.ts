import type Bookshelf from "bookshelf";

import { resourceConstants } from "../../constants/acl/resource-constants";

export default (_bookshelf: Bookshelf) => ({
  tableName: "invitations",
  idAttribute: "id",
  requireFetch: false,

  organization(this: any) {
    return this.belongsTo("organization", "organization_id");
  },

  getResourceId(): string {
    return resourceConstants.INVITATION;
  },

  isAccepted(this: any): boolean {
    return this.get("accepted_at") !== null;
  },

  isRevoked(this: any): boolean {
    return this.get("revoked_at") !== null;
  },

  isExpiredAt(this: any, now: Date): boolean {
    return new Date(this.get("expires_at")).getTime() <= now.getTime();
  },
});
