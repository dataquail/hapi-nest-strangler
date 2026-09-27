import { Module } from "@nestjs/common";

import { RoleModule } from "@/modules/role/role.module.js";
import { UserModule } from "@/modules/user/user.module.js";

import { authCommandHandlers } from "./auth.command-handlers.js";
import { authQueryHandlers } from "./auth.query-handlers.js";
import { ApiTokenRepository } from "./domain/api-token/api-token.repository.js";
import { AuthIdentityRepository } from "./domain/auth-identity/auth-identity.repository.js";
import { DeviceGrantRepository } from "./domain/device-grant/device-grant.repository.js";
import { PlatformRoles } from "./domain/ports/acl/platform-roles.acl.js";
import { UserProvisioning } from "./domain/ports/acl/user-provisioning.acl.js";
import { SessionRepository } from "./domain/session/session.repository.js";
import { PlatformRolesLive } from "./infrastructure/acl/platform-roles.acl-live.js";
import { UserProvisioningLive } from "./infrastructure/acl/user-provisioning.acl-live.js";
import { OidcClient } from "./infrastructure/clients/oidc.client.js";
import { ApiTokenRepositoryLive } from "./infrastructure/repositories/api-token.repository-live.js";
import { AuthIdentityRepositoryLive } from "./infrastructure/repositories/auth-identity.repository-live.js";
import { DeviceGrantRepositoryLive } from "./infrastructure/repositories/device-grant.repository-live.js";
import { SessionRepositoryLive } from "./infrastructure/repositories/session.repository-live.js";
import { authCliEndpoints } from "./interface/cli/index.js";
import { authEndpoints } from "./interface/http/index.js";

@Module({
  imports: [RoleModule, UserModule],
  controllers: [...authEndpoints, ...authCliEndpoints],
  providers: [
    ...authCommandHandlers,
    ...authQueryHandlers,
    { provide: SessionRepository, useClass: SessionRepositoryLive },
    { provide: AuthIdentityRepository, useClass: AuthIdentityRepositoryLive },
    { provide: ApiTokenRepository, useClass: ApiTokenRepositoryLive },
    { provide: DeviceGrantRepository, useClass: DeviceGrantRepositoryLive },
    { provide: PlatformRoles, useClass: PlatformRolesLive },
    { provide: UserProvisioning, useClass: UserProvisioningLive },
    OidcClient,
  ],
})
export class AuthModule {}
