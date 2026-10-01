import { Ok, type Result } from "oxide.ts";

import { PlatformRoles } from "@/modules/todos/domain/ports/acl/platform-roles.acl.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

export class PlatformRolesFake extends PlatformRoles {
  constructor(private readonly superAdmins: ReadonlySet<UserId> = new Set()) {
    super();
  }

  public isSuperAdmin(userId: UserId): Promise<Result<boolean, PersistenceUnavailable>> {
    return Promise.resolve(Ok(this.superAdmins.has(userId)));
  }
}
