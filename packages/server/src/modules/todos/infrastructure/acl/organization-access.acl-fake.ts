import { Ok, type Result } from "oxide.ts";

import { OrganizationAccess } from "@/modules/todos/domain/ports/acl/organization-access.acl.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

export class OrganizationAccessFake extends OrganizationAccess {
  constructor(private readonly members: ReadonlySet<string> = new Set()) {
    super();
  }

  public isMember(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<boolean, PersistenceUnavailable>> {
    return Promise.resolve(Ok(this.members.has(`${userId}:${organizationId}`)));
  }
}
