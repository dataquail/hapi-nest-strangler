import { Err, Ok, type Result } from "oxide.ts";

import {
  UserProvisioning,
  UserProvisioningConflict,
} from "@/modules/auth/domain/ports/acl/user-provisioning.acl.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

export class UserProvisioningFake extends UserProvisioning {
  public readonly provisioned = new Map<string, UserId>();

  public provision(
    email: string,
  ): Promise<Result<UserId, PersistenceUnavailable | UserProvisioningConflict>> {
    if (this.provisioned.has(email))
      return Promise.resolve(Err(new UserProvisioningConflict({ email })));
    const id = UserId.parse(crypto.randomUUID());
    this.provisioned.set(email, id);
    return Promise.resolve(Ok(id));
  }
}
