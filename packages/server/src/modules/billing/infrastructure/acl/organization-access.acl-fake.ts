import { Ok, type Result } from "oxide.ts";

import { OrganizationAccess } from "@/modules/billing/domain/ports/acl/organization-access.acl.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

export const accessKey = (userId: UserId, organizationId: OrganizationId): string =>
  `${userId}::${organizationId}`;

// Admins are not implicitly members: seed both when a test needs both, so a
// test granting only admin still exercises the read/mutate split honestly.
export class OrganizationAccessFake extends OrganizationAccess {
  constructor(
    private readonly seed: {
      readonly members?: ReadonlySet<string>;
      readonly admins?: ReadonlySet<string>;
    } = {},
  ) {
    super();
  }

  public isMember(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<boolean, PersistenceUnavailable>> {
    return Promise.resolve(Ok(this.seed.members?.has(accessKey(userId, organizationId)) ?? false));
  }

  public isAdmin(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<boolean, PersistenceUnavailable>> {
    return Promise.resolve(Ok(this.seed.admins?.has(accessKey(userId, organizationId)) ?? false));
  }
}
