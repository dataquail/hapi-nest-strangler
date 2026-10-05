import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

export abstract class OrganizationAccess {
  public abstract isMember(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<boolean, PersistenceUnavailable>>;
}
