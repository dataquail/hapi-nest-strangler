import { Global, Module } from "@nestjs/common";
import { makePolicyRegistry, makeResourceResolverRegistry } from "@org/authz";

import { Authz, PolicyRegistry, ResourceResolverRegistry } from "@/platform/auth/authz.js";

// The authorizer over the folded policy and resolver registries. Both are
// empty until the first module with user-facing endpoints arrives from the
// legacy API; adding one means one import and one entry in each factory.
@Global()
@Module({
  providers: [
    { provide: PolicyRegistry, useFactory: () => makePolicyRegistry([]) },
    { provide: ResourceResolverRegistry, useFactory: () => makeResourceResolverRegistry({}) },
    Authz,
  ],
  exports: [Authz],
})
export class AuthzModule {}
