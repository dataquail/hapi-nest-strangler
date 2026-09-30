import { Global, Module } from "@nestjs/common";
import { makePolicyRegistry, makeResourceResolverRegistry } from "@org/authz";

import { Authenticator } from "@/platform/auth/authenticator.js";
import { Authz, PolicyRegistry, ResourceResolverRegistry } from "@/platform/auth/authz.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { AuthenticatorLive } from "@/platform/middlewares/authenticator-live.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

// Every user-facing endpoint names the guard and the authorizer, so both are
// global. The registries are empty until the first module with user-facing
// endpoints arrives from the legacy API; adding one means one import and one
// entry in each factory.
@Global()
@Module({
  providers: [
    CookieCodec,
    { provide: Authenticator, useClass: AuthenticatorLive },
    UserAuthGuard,
    { provide: PolicyRegistry, useFactory: () => makePolicyRegistry([]) },
    { provide: ResourceResolverRegistry, useFactory: () => makeResourceResolverRegistry({}) },
    Authz,
  ],
  exports: [CookieCodec, Authenticator, UserAuthGuard, Authz],
})
export class AuthzModule {}
