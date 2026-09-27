import { Module } from "@nestjs/common";

import { RoleModule } from "@/modules/role/role.module.js";
import { UserModule } from "@/modules/user/user.module.js";

import { InvitationRepository } from "./domain/invitation/invitation.repository.js";
import { MembershipRepository } from "./domain/membership/membership.repository.js";
import { OrganizationRepository } from "./domain/organization/organization.repository.js";
import { OrganizationRolesRepository } from "./domain/organization-roles/organization-roles.repository.js";
import { PlatformRoles } from "./domain/ports/acl/platform-roles.acl.js";
import { UsersLookup } from "./domain/ports/acl/users-lookup.acl.js";
import { InvitationMailer } from "./domain/ports/clients/invitation-mailer.client.js";
import { PlatformRolesLive } from "./infrastructure/acl/platform-roles.acl-live.js";
import { UsersLookupLive } from "./infrastructure/acl/users-lookup.acl-live.js";
import { InvitationMailerLive } from "./infrastructure/clients/invitation-mailer.client-live.js";
import { InvitationRepositoryLive } from "./infrastructure/repositories/invitation.repository-live.js";
import { MembershipRepositoryLive } from "./infrastructure/repositories/membership.repository-live.js";
import { OrganizationRepositoryLive } from "./infrastructure/repositories/organization.repository-live.js";
import { OrganizationRolesRepositoryLive } from "./infrastructure/repositories/organization-roles.repository-live.js";
import { organizationCliEndpoints } from "./interface/cli/index.js";
import { InvitationEventAdapter } from "./interface/events/invitation.event-adapter.js";
import { organizationEndpoints } from "./interface/http/index.js";
import { organizationCommandHandlers } from "./organization.command-handlers.js";
import { organizationQueryHandlers } from "./organization.query-handlers.js";
import { OrganizationPolicyContribution } from "./policies/organization.policies.js";
import { OrganizationResolverEntry } from "./policies/organization.resource-resolver.js";

@Module({
  imports: [RoleModule, UserModule],
  controllers: [...organizationEndpoints, ...organizationCliEndpoints],
  providers: [
    ...organizationCommandHandlers,
    ...organizationQueryHandlers,
    { provide: OrganizationRepository, useClass: OrganizationRepositoryLive },
    { provide: MembershipRepository, useClass: MembershipRepositoryLive },
    { provide: InvitationRepository, useClass: InvitationRepositoryLive },
    { provide: OrganizationRolesRepository, useClass: OrganizationRolesRepositoryLive },
    { provide: PlatformRoles, useClass: PlatformRolesLive },
    { provide: UsersLookup, useClass: UsersLookupLive },
    { provide: InvitationMailer, useClass: InvitationMailerLive },
    InvitationEventAdapter,
    OrganizationPolicyContribution,
    OrganizationResolverEntry,
  ],
  exports: [OrganizationPolicyContribution, OrganizationResolverEntry],
})
export class OrganizationModule {}
