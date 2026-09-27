import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";
import type { UserId } from "@/platform/ids/user-id.js";

export class UserProvisioningConflict extends TaggedError("UserProvisioningConflict")<{
  readonly email: string;
}> {}

export abstract class UserProvisioning {
  public abstract provision(
    email: string,
  ): Promise<Result<UserId, PersistenceUnavailable | UserProvisioningConflict>>;
}
