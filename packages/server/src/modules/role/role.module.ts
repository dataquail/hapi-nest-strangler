import { Module } from "@nestjs/common";

import { RolesRepository } from "./domain/roles/roles.repository.js";
import { RolesRepositoryLive } from "./infrastructure/repositories/roles.repository-live.js";
import { roleCommandHandlers } from "./role.command-handlers.js";
import { roleQueryHandlers } from "./role.query-handlers.js";

@Module({
  providers: [
    ...roleCommandHandlers,
    ...roleQueryHandlers,
    { provide: RolesRepository, useClass: RolesRepositoryLive },
  ],
})
export class RoleModule {}
