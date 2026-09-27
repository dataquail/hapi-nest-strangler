import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

// Any member may read the org's subscription; only an admin may take on or
// cancel a financial commitment. Which org role confers that authority is
// the adapter's decision, so the org module's role vocabulary stays out.
export abstract class OrganizationAccess {
  public abstract isMember(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<boolean, PersistenceUnavailable>>;
  public abstract isAdmin(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<boolean, PersistenceUnavailable>>;
}
