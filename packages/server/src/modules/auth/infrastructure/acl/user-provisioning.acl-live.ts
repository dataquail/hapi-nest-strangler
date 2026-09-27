import { Inject, Injectable } from "@nestjs/common";
import { Err, type Result } from "oxide.ts";

import { userAccessCommands } from "@/modules/auth/auth.imports.js";
import {
  UserProvisioning,
  UserProvisioningConflict,
} from "@/modules/auth/domain/ports/acl/user-provisioning.acl.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

// The user module's vocabulary stops here: its conflict error becomes this
// module's own (ADR-0022).
@Injectable()
export class UserProvisioningLive extends UserProvisioning {
  constructor(@Inject(AppCommandBus) private readonly commands: AppCommandBus) {
    super();
  }

  public async provision(
    email: string,
  ): Promise<Result<UserId, PersistenceUnavailable | UserProvisioningConflict>> {
    const created = await this.commands.execute(
      new userAccessCommands.CreateUserCommand({ email }),
    );
    if (created.isOk()) return created;
    const error = created.unwrapErr();
    return error._tag === "UserAlreadyExists"
      ? Err(new UserProvisioningConflict({ email }))
      : Err(error);
  }
}
