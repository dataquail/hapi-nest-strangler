import { Module } from "@nestjs/common";

import { OrganizationModule } from "@/modules/organization/organization.module.js";
import { RoleModule } from "@/modules/role/role.module.js";

import { OrganizationAccess } from "./domain/ports/acl/organization-access.acl.js";
import { PlatformRoles } from "./domain/ports/acl/platform-roles.acl.js";
import { TodosRepository } from "./domain/todo/todos.repository.js";
import { OrganizationAccessLive } from "./infrastructure/acl/organization-access.acl-live.js";
import { PlatformRolesLive } from "./infrastructure/acl/platform-roles.acl-live.js";
import { TodosRepositoryLive } from "./infrastructure/repositories/todos.repository-live.js";
import { todosCliEndpoints } from "./interface/cli/index.js";
import { todosEndpoints } from "./interface/http/index.js";
import {
  TodoCollectionResolverEntry,
  TodoResolverEntry,
} from "./policies/todo.resource-resolvers.js";
import { TodoPolicyContribution } from "./policies/todos.policies.js";
import { todoCommandHandlers } from "./todo.command-handlers.js";
import { todoQueryHandlers } from "./todo.query-handlers.js";

// A module states its own imports by importing them (ADR-0032): the modules it
// reaches through its ACL ports are named here, and nowhere else.
@Module({
  imports: [OrganizationModule, RoleModule],
  controllers: [...todosEndpoints, ...todosCliEndpoints],
  providers: [
    ...todoCommandHandlers,
    ...todoQueryHandlers,
    { provide: TodosRepository, useClass: TodosRepositoryLive },
    { provide: OrganizationAccess, useClass: OrganizationAccessLive },
    { provide: PlatformRoles, useClass: PlatformRolesLive },
    TodoPolicyContribution,
    TodoCollectionResolverEntry,
    TodoResolverEntry,
  ],
  exports: [TodoPolicyContribution, TodoCollectionResolverEntry, TodoResolverEntry],
})
export class TodosModule {}
