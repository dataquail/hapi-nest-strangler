import type Bookshelf from "bookshelf";

import { resourceConstants } from "../../constants/acl/resource-constants";
import { roleConstants } from "../../constants/acl/role-constants";

// The bookshelf user is what the ACL is asked about: `getRoleId` folds the
// platform roles relation in, and `getResourceId` makes a user row a resource.
export default (_bookshelf: Bookshelf) => ({
  tableName: "users",
  idAttribute: "id",
  hasTimestamps: ["created_at", "updated_at"],
  requireFetch: false,

  roles(this: any) {
    return this.hasMany("role", "user_id");
  },

  getRoleId(this: any): string[] {
    const granted = this.related("roles")
      .toJSON()
      .map((row: { role: string }) => row.role);
    return [roleConstants.USER, ...granted];
  },

  getResourceId(): string {
    return resourceConstants.USER;
  },

  isSuperAdmin(this: any): boolean {
    return this.getRoleId().includes(roleConstants.SUPER_ADMIN);
  },
});
