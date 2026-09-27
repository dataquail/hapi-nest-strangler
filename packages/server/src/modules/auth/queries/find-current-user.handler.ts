import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";

import { PlatformRoles } from "../domain/ports/acl/platform-roles.acl.js";
import { FindCurrentUserQuery, type FindCurrentUserResult } from "./find-current-user.query.js";

// No SQL of its own: the only field beyond the caller's id belongs to the
// role module, reached through this module's port.
@QueryHandler(FindCurrentUserQuery)
export class FindCurrentUserHandler implements IQueryHandler<FindCurrentUserQuery> {
  constructor(@Inject(PlatformRoles) private readonly roles: PlatformRoles) {}

  public async execute({ payload }: FindCurrentUserQuery): Promise<FindCurrentUserResult> {
    const isSuperAdmin = await this.roles.isSuperAdmin(payload.userId);
    return isSuperAdmin.map((flag) => ({ userId: payload.userId, isSuperAdmin: flag }));
  }
}
